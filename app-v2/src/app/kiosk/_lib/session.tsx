"use client";

/** The kiosk session — one lifetime that spans every kiosk route.
 *
 *  The composition holds LIVE STOCK RESERVATIONS. A soft hold is taken before
 *  a transfer ever appears on the canvas, so if the thing that owns those
 *  holds unmounted on every navigation, a customer stepping from the canvas to
 *  the details screen would orphan real stock for thirty minutes while a queue
 *  waits.
 *
 *  That is why the kiosk is a set of routes but a single provider: a Next.js
 *  layout does not unmount when its child route changes, so `useCanvas` and
 *  its holds live for exactly as long as the customer does. Every screen is a
 *  real URL (a volunteer can hard-reload straight into one, and every screen
 *  guards its own prerequisites), while the reservation lifetime stays whole.
 *
 *  It also owns the two things a customer-facing screen cannot be without:
 *
 *    - START OVER, which releases every hold before clearing state.
 *    - THE IDLE RESET, which returns an abandoned kiosk to the attract screen
 *      so the next stranger is never handed the last one's phone number. */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getBackend } from "@/lib/backend";
import type { Catalogue } from "@/lib/backend";
import { track } from "@/lib/analytics";
import { getKioskSessionId, resetKioskSession } from "@/lib/device";
import { useAsync } from "@/lib/hooks/useAsync";
import { useCanvas } from "@/lib/hooks/useCanvas";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import type { Environment, KioskDesign, Order, ProductSku, StockRow, Template } from "@/lib/domain/types";

/** An unattended kiosk resets itself. Long enough that nobody reading the
 *  "what happens now" steps gets thrown off mid-sentence, short enough that
 *  the next person in the queue meets a fresh screen. */
const IDLE_MS = 120_000;

type KioskSession = {
  environment: Environment | null;
  bound: boolean;
  envLoading: boolean;

  catalogue: Catalogue | null;
  catalogueLoading: boolean;
  /** This environment's own available stock, overlaid onto the catalogue. */
  skus: ProductSku[];

  designs: KioskDesign[];
  designsLoading: boolean;
  designsError: string | null;

  templates: Template[];
  templatesLoading: boolean;

  canvas: ReturnType<typeof useCanvas>;

  order: Order | null;
  setOrder: (o: Order) => void;

  /** Release everything, forget the customer, go back to attract. */
  startOver: () => Promise<void>;
};

const Ctx = createContext<KioskSession | null>(null);

export function useKiosk(): KioskSession {
  const value = useContext(Ctx);
  if (!value) throw new Error("useKiosk must be used inside the kiosk layout");
  return value;
}

export function KioskSessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { environment, bound, loading: envLoading } = useEnvironment();
  const envId = environment?.id ?? null;

  const [order, setOrder] = useState<Order | null>(null);
  const canvas = useCanvas(envId);

  const catalogue = useAsync(() => getBackend().getCatalogue(), []);
  const designs = useAsync(
    () => (envId ? getBackend().getKioskCatalogue(envId) : Promise.resolve({ ok: true as const, data: [] })),
    [envId]
  );
  const templates = useAsync(() => getBackend().listTemplates(), []);

  // `stock_qty` on the catalogue is an org-wide total across every stall and
  // the warehouse. Picking a garment off that number lets a customer choose
  // something that is actually sold out AT THIS STALL and only find out at the
  // counter, so this environment's own available stock is overlaid on top.
  const locations = useAsync(() => getBackend().listStockLocations(), []);
  const location = locations.data?.find((l) => l.environment_id === envId);
  const localStock = useAsync(
    () =>
      location
        ? getBackend().getStock(location.id)
        : Promise.resolve({ ok: true as const, data: [] as StockRow[] }),
    [location?.id]
  );

  const skus = useMemo(() => {
    if (!catalogue.data) return [];
    // Until the local rows have genuinely settled, report the catalogue as-is
    // rather than briefly claiming every garment is sold out.
    if (!localStock.data || locations.loading || localStock.loading) return catalogue.data.skus;
    const byId = new Map(
      localStock.data.filter((r) => r.sku_type === "product").map((r) => [r.sku_id, r.available_qty])
    );
    return catalogue.data.skus.map((s) => ({ ...s, stock_qty: byId.get(s.id) ?? 0 }));
  }, [catalogue.data, localStock.data, locations.loading, localStock.loading]);

  useEffect(() => {
    if (!envId) return;
    getKioskSessionId();
    track(envId, "session_started");
  }, [envId]);

  // Kept in a ref so the idle timer below can call the latest version without
  // re-arming itself on every placement.
  const canvasRef = useRef(canvas);
  useEffect(() => {
    canvasRef.current = canvas;
  });

  const startOver = useCallback(async () => {
    const c = canvasRef.current;
    await c.releaseAll();
    c.reset();
    setOrder(null);
    resetKioskSession();
    void designs.reload();
    router.replace("/kiosk");
    // `designs.reload` is stable via useAsync's signature cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // ── Idle reset ────────────────────────────────────────────────────────────
  // Only ever runs away from the attract screen: an untouched attract screen
  // is doing its job, and resetting it would fight its own animation.
  const idlePath = pathname !== "/kiosk";
  useEffect(() => {
    if (!idlePath) return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (envId) track(envId, "order_abandoned", { reason: "idle" });
        void startOver();
      }, IDLE_MS);
    };
    arm();
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "wheel", "touchstart"];
    for (const e of events) window.addEventListener(e, arm, { passive: true });
    return () => {
      clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, arm);
    };
  }, [idlePath, envId, startOver]);

  const value: KioskSession = {
    environment,
    bound,
    envLoading,
    catalogue: catalogue.data,
    catalogueLoading: catalogue.loading,
    skus,
    designs: designs.data ?? [],
    designsLoading: designs.loading,
    designsError: designs.error,
    templates: templates.data ?? [],
    templatesLoading: templates.loading,
    canvas,
    order,
    setOrder,
    startOver,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
