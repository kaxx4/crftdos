/** Routable alias for the design gallery.
 *
 *  The gallery itself lives in `../_design/page.tsx`. `_design` is a Next
 *  PRIVATE folder — anything under an underscore-prefixed directory is opted
 *  out of routing entirely — so the module there would never render on its
 *  own. This file is the four lines that make it viewable at /design. */
export { default } from "../_design/page";
