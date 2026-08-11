import { useEffect, useState } from "react";
import type { Color, Design, Fit, Preset, Sku } from "../types";

export function useKioskCatalogue() {
  const [colors, setColors] = useState<Color[]>([]);
  const [fits, setFits] = useState<Fit[]>([]);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [colorId, setColorId] = useState<string | null>(null);
  const [fitId, setFitId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/kiosk/catalogue")
      .then((r) => r.json())
      .then((j) => {
        setColors(j.colors || []);
        setFits(j.fits || []);
        setSkus(j.skus || []);
        // A design with no print dimensions cannot be rendered true-scale,
        // and true-scale is the constraint the whole canvas rests on
        // (PRD §4.3: "The customer sees what they will actually get").
        // print_w_cm / print_h_cm are nullable and unset on most seeded
        // rows; rendering one produces a zero-size or NaN-positioned
        // sticker with no error. Hiding it is the honest failure — a
        // volunteer can still add it at the till.
        setDesigns(
          ((j.designs || []) as Design[]).filter((d) => Number(d.print_w_cm) > 0 && Number(d.print_h_cm) > 0)
        );
        setPresets(j.presets || []);
        if (j.colors?.[0]) setColorId(j.colors[0].id);
        if (j.fits?.[0]) setFitId(j.fits[0].id);
      })
      .catch(() => setError("Could not load the catalogue. Ask a volunteer for help."))
      .finally(() => setLoading(false));
  }, []);

  return { colors, fits, skus, designs, presets, colorId, setColorId, fitId, setFitId, loading, error };
}
