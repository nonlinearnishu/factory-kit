import { defineConfig } from "vitest/config";

// Coverage floor is load-bearing, not decorative (factory-ci.md). The merge
// gate runs `test:coverage`; thresholds live here, never overridden at CI.
export default defineConfig({
  test: {
    include: ["check/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["check/**/*.ts"],
      exclude: ["check/**/__tests__/**", "check/index.ts", "check/rules/types.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
