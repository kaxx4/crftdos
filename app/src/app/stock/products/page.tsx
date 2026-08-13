"use client";
import { useEffect, useState } from "react";
import { PosFrame } from "@/components/PosFrame";
import { FirstRunHint } from "@/components/FirstRunHint";
import { TabBar } from "@/components/TabBar";
import { Card, Mono, PanelLabel } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Color, Fit, ProductSku } from "@/lib/types";

export default function ProductStockPage() {
  const [skus, setSkus] = useState<ProductSku[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [fits, setFits] = useState<Fit[]>([]);

  useEffect(() => {
    const sb = supabaseBrowser();
    Promise.all([
      sb.from("stall_product_skus").select("*").order("sku_code"),
      sb.from("stall_colors").select("*"),
      sb.from("stall_fits").select("*"),
    ]).then(([s, c, f]) => {
      setSkus(s.data || []);
      setColors(c.data || []);
      setFits(f.data || []);
    });
  }, []);

  return (
    <div className="contents">
      <PosFrame
        helpTopic="sell" nav={<TabBar />} kicker="VOLUNTEER · STOCK" title="Products">
        <FirstRunHint
          id="stockproducts"
          title="What this shows"
          points={[
            "This is the live count of blank garments, straight from the shared stock.",
            "It's read-only on purpose. Numbers change through Restock, a sale, Waste or a void — each recorded with a reason.",
            "Red means none left.",
          ]}
        />
        {/* Read-only by design: RLS gives anon SELECT-only on this table
            (PRD §12), and there is no server write route for it. The previous
            version showed a tappable "edit" affordance — a number field and an
            OK button, both permanently disabled — that always ended in an
            alert() saying the write was blocked. A control someone can tap
            that never works is worse than no control, and its disabled state
            was also how the 11×28px touch targets on this page got that
            small: no one had sized a real button, because there wasn't one.
            Stock now changes hands through restock, sale, waste and void,
            every one of which is a server route that writes the ledger. */}
        <PanelLabel>Garments in stock</PanelLabel>
        <div className="flex flex-col gap-1.5">
          {skus.map((s) => {
            const color = colors.find((c) => c.id === s.color_id)?.name;
            const fit = fits.find((f) => f.id === s.fit_id)?.name;
            return (
              <Card key={s.id} className="p-2.5">
                <div className="flex justify-between items-center gap-2">
                  <div>
                    <div className="font-extrabold text-sm">{s.sku_code}</div>
                    <Mono>
                      {color} · {fit} · {s.size}
                    </Mono>
                  </div>
                  <div className={`font-extrabold text-lg ${s.stock_qty <= 0 ? "text-signal" : ""}`}>
                    {s.stock_qty}
                  </div>
                </div>
              </Card>
            );
          })}
          {skus.length === 0 && (
            <div className="text-center text-sm text-muted py-6">
              No products yet. Import them from Admin → Catalogue, or ask an admin to add the starter tees.
            </div>
          )}
        </div>
        <div className="font-mono text-[13px] text-muted border border-dashed border-hairline p-2.5">
          To change stock, use Restock, ring up a sale, or log a Waste entry — each one is recorded with a
          reason, so you can always see why a number changed. Bulk import lives in Admin → Catalogue.
        </div>
      </PosFrame>
    </div>
  );
}
