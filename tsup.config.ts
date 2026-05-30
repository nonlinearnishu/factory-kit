import { defineConfig } from "tsup";

// Builds the factory-kit-check engine. The bin shim (bin/factory-kit-check.js)
// imports the compiled runner from dist/. Source of truth is check/.
export default defineConfig({
  entry: ["check/index.ts"],
  format: ["esm"],
  outDir: "dist",
  target: "node18",
  clean: true,
  splitting: false,
  sourcemap: false,
  dts: false,
});
