import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["spec/**/*.test.ts", "scripts/**/*.test.ts"],
    globalSetup: ["./spec/global-setup.ts"],
    // The course list's axe pass walks ~128 rows, each now with its own
    // like-toggle form — past the default 5s in jsdom.
    testTimeout: 15000,
  },
});
