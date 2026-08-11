"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDeviceId } from "@/lib/deviceId";
import type { Order } from "../types";

/** Loads the current shift and its orders, redirecting to shift-open if no
 *  shift is active on this device. */
export function useOrdersBoot() {
  const router = useRouter();
  const [shift, setShift] = useState<{ id: string; name: string } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/shift/current?deviceId=${getDeviceId()}`);
      const j = await res.json();
      if (!j.shift) {
        router.replace("/shift-open");
        return;
      }
      setShift(j.shift);
      const oRes = await fetch(`/api/orders?shiftId=${j.shift.id}`);
      const oJson = await oRes.json();
      setOrders(oJson.orders || []);
    }
    load();
  }, [router]);

  return { shift, orders, setOrders };
}
