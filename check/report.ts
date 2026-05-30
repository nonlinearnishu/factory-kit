import pc from "picocolors";
import type { Finding, Severity } from "./rules/types.js";

export interface ReportMeta {
  rulesRun: number;
  rulesDisabled: number;
  filesScanned: number;
  filesSkipped: number;
  // Known pitfalls not yet covered by a rule, per language. Surfaced so the
  // tool never implies full coverage (no silent caps).
  uncovered: { ts: number; py: number };
}

const ORDER: Severity[] = ["critical", "high", "medium", "low"];

function badge(sev: Severity): string {
  switch (sev) {
    case "critical":
      return pc.bgRed(pc.white(" CRIT "));
    case "high":
      return pc.red(" HIGH ");
    case "medium":
      return pc.yellow(" MED  ");
    case "low":
      return pc.dim(" LOW  ");
  }
}

function loc(f: Finding): string {
  return f.line ? `${f.file}:${f.line}` : f.file;
}

export function report(findings: Finding[], meta: ReportMeta): void {
  console.log("");
  console.log(pc.bold("factory-kit-check") + pc.dim("  · read-only · we read and judge, we never write"));
  console.log("");

  if (findings.length === 0) {
    console.log(pc.green("  ✓ no findings"));
  } else {
    for (const sev of ORDER) {
      const group = findings.filter((f) => f.severity === sev);
      if (group.length === 0) continue;
      console.log(`${badge(sev)} ${pc.bold(String(group.length))} ${sev}`);
      for (const f of group) {
        console.log(`    ${pc.cyan(loc(f))}  ${f.message}`);
        console.log(`        ${pc.dim("→ " + f.skillRef)} ${pc.dim("[" + f.ruleId + "]")}`);
      }
      console.log("");
    }
  }

  // Footer — counts, the disabled-rule signal, and honest uncovered counts.
  const counts = ORDER.map((s) => `${findings.filter((f) => f.severity === s).length} ${s}`).join("  ");
  console.log(pc.dim("─".repeat(60)));
  console.log(`  ${counts}`);
  console.log(
    pc.dim(
      `  ${meta.rulesRun} rules run · ${meta.filesScanned} files scanned · ${meta.filesSkipped} skipped`
    )
  );
  if (meta.rulesDisabled > 0) {
    const warn = meta.rulesDisabled > 4 ? pc.yellow : pc.dim;
    console.log(
      warn(
        `  ${meta.rulesDisabled} rule(s) disabled` +
          (meta.rulesDisabled > 4 ? " — >4 disabled suggests the rule design is wrong, not the repo" : "")
      )
    );
  }
  console.log(
    pc.dim(
      `  not yet covered: ${meta.uncovered.ts} known TS pitfalls, ${meta.uncovered.py} known Python pitfalls`
    )
  );
  console.log("");
}
