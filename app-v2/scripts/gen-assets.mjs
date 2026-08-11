/** Generates the placeholder artwork the mock backend refers to: 12 sticker
 *  cutouts and 2 tee mockups. Real cutout PNGs and product photos replace
 *  these via /admin/catalogue once they exist — see `Known Issues.md` §"Content
 *  to replace when the real numbers arrive".
 *
 *  SVG rather than PNG on purpose: the canvas renders these at true physical
 *  scale, so they get resized a lot, and a vector stays crisp on a tablet at
 *  any print size. Run with `node scripts/gen-assets.mjs`. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stickerDir = join(root, "public", "stickers");
const mockupDir = join(root, "public", "mockups");
mkdirSync(stickerDir, { recursive: true });
mkdirSync(mockupDir, { recursive: true });

const ink = "#0f0f10";
const blue = "#1b4df5";
const sand = "#e9dcc3";
const teal = "#0f7d78";
const coral = "#e8552a";

/** Each design is drawn inside a 200x200 viewBox and is expected to be
 *  transparent outside its silhouette — the canvas composites it over a tee. */
const art = {
  wave: `<path d="M10 130q30-38 60 0t60 0 60-4" fill="none" stroke="${blue}" stroke-width="13" stroke-linecap="round"/>
         <path d="M10 100q30-38 60 0t60 0 60-4" fill="none" stroke="${teal}" stroke-width="11" stroke-linecap="round" opacity=".85"/>
         <path d="M10 160q30-38 60 0t60 0 60-4" fill="none" stroke="${ink}" stroke-width="9" stroke-linecap="round" opacity=".5"/>`,
  turtle: `<ellipse cx="100" cy="105" rx="58" ry="46" fill="${teal}"/>
           <circle cx="100" cy="52" r="19" fill="${teal}"/>
           <g fill="${ink}" opacity=".35"><path d="M100 68l26 18-10 30h-32l-10-30z"/></g>
           <g fill="${teal}"><ellipse cx="42" cy="76" rx="19" ry="12" transform="rotate(-32 42 76)"/>
           <ellipse cx="158" cy="76" rx="19" ry="12" transform="rotate(32 158 76)"/>
           <ellipse cx="50" cy="142" rx="16" ry="10" transform="rotate(28 50 142)"/>
           <ellipse cx="150" cy="142" rx="16" ry="10" transform="rotate(-28 150 142)"/></g>`,
  coral: `<g stroke="${coral}" stroke-width="12" stroke-linecap="round" fill="none">
            <path d="M100 175V95"/><path d="M100 120L66 88"/><path d="M100 130l34-32"/>
            <path d="M66 88V58"/><path d="M134 98V66"/><path d="M100 95V50"/></g>
          <g fill="${coral}"><circle cx="66" cy="52" r="11"/><circle cx="134" cy="60" r="11"/><circle cx="100" cy="44" r="12"/></g>`,
  droplet: `<path d="M100 24c30 44 44 66 44 88a44 44 0 11-88 0c0-22 14-44 44-88z" fill="${blue}"/>
            <path d="M78 118a24 24 0 0016 30" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".75"/>`,
  fish: `<path d="M28 100c34-40 92-40 122 0-30 40-88 40-122 0z" fill="${blue}"/>
         <path d="M150 100l30-26v52z" fill="${blue}"/>
         <circle cx="72" cy="94" r="8" fill="#fff"/><circle cx="72" cy="94" r="4" fill="${ink}"/>
         <path d="M104 74c10 16 10 36 0 52" fill="none" stroke="#fff" stroke-width="6" opacity=".6"/>`,
  leaf: `<path d="M100 176C56 140 44 92 66 44c50-4 84 26 88 74 2 34-22 52-54 58z" fill="${teal}"/>
         <path d="M100 176C92 130 104 82 140 52" fill="none" stroke="#fff" stroke-width="7" opacity=".7"/>`,
  mountain: `<path d="M16 158l52-84 34 50 26-36 56 70z" fill="${ink}"/>
             <path d="M68 74l20 32H48z" fill="#fff" opacity=".85"/>
             <circle cx="150" cy="50" r="18" fill="${coral}"/>`,
  sun: `<circle cx="100" cy="100" r="42" fill="${coral}"/>
        <g stroke="${coral}" stroke-width="11" stroke-linecap="round">
          <path d="M100 30V10"/><path d="M100 190v-20"/><path d="M30 100H10"/><path d="M190 100h-20"/>
          <path d="M50 50L36 36"/><path d="M150 150l14 14"/><path d="M150 50l14-14"/><path d="M50 150l-14 14"/></g>`,
  whale: `<path d="M22 118c14-40 62-58 104-42 30 12 46 34 52 62-40 14-118 16-156-20z" fill="${blue}"/>
          <path d="M178 138l14-40 12 44z" fill="${blue}"/>
          <circle cx="66" cy="100" r="7" fill="#fff"/>
          <path d="M100 60c8-16 26-18 34-6" fill="none" stroke="${blue}" stroke-width="8" stroke-linecap="round"/>`,
  reef: `<g fill="${teal}"><circle cx="60" cy="140" r="26"/><circle cx="110" cy="152" r="18"/><circle cx="146" cy="134" r="22"/></g>
         <g stroke="${coral}" stroke-width="10" stroke-linecap="round" fill="none">
           <path d="M60 116V70"/><path d="M110 134V88"/><path d="M146 112V76"/></g>
         <g fill="${sand}"><circle cx="60" cy="64" r="10"/><circle cx="110" cy="82" r="10"/><circle cx="146" cy="70" r="10"/></g>`,
  roots: `<g stroke="${ink}" stroke-width="11" stroke-linecap="round" fill="none">
            <path d="M100 20v70"/><path d="M100 90c-24 16-32 44-30 76"/><path d="M100 90c24 16 32 44 30 76"/>
            <path d="M100 110c-14 20-38 24-58 18"/><path d="M100 110c14 20 38 24 58 18"/></g>
          <circle cx="100" cy="22" r="16" fill="${teal}"/>`,
  compass: `<circle cx="100" cy="100" r="70" fill="none" stroke="${ink}" stroke-width="10"/>
            <path d="M100 42l18 46 46 18-46 18-18 46-18-46-46-18 46-18z" fill="${blue}"/>`,
};

const designs = [
  ["001", "wave", "Break Line"],
  ["002", "turtle", "Slow Traveller"],
  ["003", "coral", "Reef Stack"],
  ["004", "droplet", "One Drop"],
  ["005", "fish", "Shoal"],
  ["006", "leaf", "Canopy"],
  ["007", "mountain", "Catchment"],
  ["008", "sun", "Dry Season"],
  ["009", "whale", "Big Blue"],
  ["010", "reef", "Tide Pool"],
  ["011", "roots", "Root System"],
  ["012", "compass", "Due South"],
];

for (const [no, key] of designs) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">${art[key]}</svg>`;
  for (const size of ["S", "M", "L"]) writeFileSync(join(stickerDir, `${size}-${no}.svg`), svg);
}

/** Tee mockup. The print area declared in the seed must match the rectangle
 *  drawn here, or true-scale rendering silently lies about physical size. */
function tee(bodyHex, isDark) {
  const seam = isDark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.14)";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <path d="M250 90l-140 70 44 128 74-30v612h544V258l74 30 44-128-140-70-124-42a90 70 0 01-252 0z"
        transform="translate(-28,0)" fill="${bodyHex}" stroke="${seam}" stroke-width="3"/>
  <path d="M276 88a124 60 0 00248 0" fill="none" stroke="${seam}" stroke-width="6"/>
</svg>`;
}
writeFileSync(join(mockupDir, "tee-black-front.svg"), tee("#17171a", true));
writeFileSync(join(mockupDir, "tee-black-back.svg"), tee("#141417", true));
writeFileSync(join(mockupDir, "tee-natural-front.svg"), tee("#efe9dc", false));
writeFileSync(join(mockupDir, "tee-natural-back.svg"), tee("#ebe4d6", false));

console.log(`wrote ${designs.length * 3} sticker cutouts and 4 mockups`);
