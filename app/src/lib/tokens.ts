/** The one place the crftd palette exists as JavaScript values.
 *
 *  CSS gets these via the custom properties in globals.css. Canvas cannot read
 *  custom properties, so the shift summary card used to re-type the hexes by
 *  hand — including a `#777` that matched no token at all. That card is the
 *  most widely-seen thing this app produces (it goes into the team WhatsApp
 *  group at every shift close), so it is the worst possible place for the
 *  palette to quietly drift.
 *
 *  Keep in sync with `:root` in src/app/globals.css. */
export const TOKENS = {
  ink: "#0F0F10",
  cream: "#F7F5F1",
  blue: "#1B4DF5",
  signal: "#C6302B",
  line: "#333333",
  muted: "#52504C",
  hairline: "#D9D5CD",
  ok: "#1C6B3F",
  warn: "#8A5A00",
} as const;
