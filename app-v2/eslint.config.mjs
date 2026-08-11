import next from "eslint-config-next";

/** Flat config directly, not via the FlatCompat shim.
 *  The shim (@eslint/eslintrc) throws "Converting circular structure to JSON"
 *  against this eslint/eslint-config-next pairing. */
const eslintConfig = [
  ...(Array.isArray(next) ? next : [next]),
  { ignores: [".next/**", "node_modules/**", "scripts/**"] },
];

export default eslintConfig;
