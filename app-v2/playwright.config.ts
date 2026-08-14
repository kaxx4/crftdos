import { defineConfig } from "@playwright/test";

/** Chromium is pre-installed in this environment and PLAYWRIGHT_BROWSERS_PATH
 *  already points at it, so there is no browser download step. */
const PORT = 3399;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // A stall runs on a touch device; hover-only affordances would be a bug.
    hasTouch: true,
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/kiosk`,
    // Never reuse: a server left over from a previous build serves stale
    // chunks against fresh HTML, which surfaces as ChunkLoadError and looks
    // like an application bug rather than a harness one.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
