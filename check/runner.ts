import { walk } from "./walk.js";
import { loadConfig } from "./config.js";
import { report } from "./report.js";
import { rules, UNCOVERED } from "./rules/index.js";
import type { Finding, RepoFile } from "./rules/types.js";

export interface RunOptions {
  targetDir: string;
}

/**
 * Pure core: run the active rule set over already-walked files, routed by
 * language tag. No I/O, no printing — this is the unit the tests exercise.
 */
export function collectFindings(files: RepoFile[], disabled: Set<string> = new Set()): Finding[] {
  const active = rules.filter((r) => !disabled.has(r.id));
  const findings: Finding[] = [];

  for (const rule of active) {
    const applicable = (f: RepoFile) => rule.languages.includes(f.lang);

    if (rule.detectFile) {
      for (const file of files) {
        if (!applicable(file)) continue;
        findings.push(...rule.detectFile(file));
      }
    }
    if (rule.detectRepo) {
      findings.push(...rule.detectRepo(files.filter(applicable)));
    }
  }
  return findings;
}

/** True if any finding gates merge (critical/high) — the GitHub Action contract. */
export function hasBlocking(findings: Finding[]): boolean {
  return findings.some((f) => f.severity === "critical" || f.severity === "high");
}

/**
 * Walk → collect → report → exit code. Returns 1 on any critical/high finding,
 * else 0. Read-only throughout: no writes to the target repo.
 */
export async function run(opts: RunOptions): Promise<number> {
  const { files, scanned, skipped } = await walk(opts.targetDir);
  const config = await loadConfig(opts.targetDir);

  const findings = collectFindings(files, config.disabledRules);

  report(findings, {
    rulesRun: rules.length - config.disabledRules.size,
    rulesDisabled: config.disabledRules.size,
    filesScanned: scanned,
    filesSkipped: skipped,
    uncovered: UNCOVERED,
  });

  return hasBlocking(findings) ? 1 : 0;
}
