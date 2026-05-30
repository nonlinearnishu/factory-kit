#!/usr/bin/env node
// factory-kit-check — read-only deterministic checker for the factory standard.
//
// Walks a repo, runs the rule set (each rule cites a factory-pitfalls.md entry),
// prints findings grouped by severity, exits non-zero on any critical/high.
//
// Thin shim, mirroring bin/factory-kit.js: the engine lives in dist/ (built
// from check/ via tsup). We read and judge; we never write.

import path from "node:path";
import { fileURLToPath } from "node:url";

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  let run;
  try {
    ({ run } = await import(path.join(KIT_ROOT, "dist", "index.js")));
  } catch {
    console.error(
      "factory-kit-check: build artifacts missing. Run `npm run build` in the kit first."
    );
    process.exit(1);
    return;
  }

  // First positional arg is the target repo; default to cwd.
  const target = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  const exitCode = await run({ targetDir: target });
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(`factory-kit-check failed: ${err?.message ?? err}`);
  process.exit(1);
});
