import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The guards read files off disk and do arithmetic — no DOM, no setup,
    // so the suite stays fast enough to run on every commit.
    environment: "node",
    include: ["tests/guards/**/*.test.ts"],
  },
});
