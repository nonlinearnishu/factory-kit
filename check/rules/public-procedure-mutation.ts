import type { Finding, Rule } from "./types.js";
import { lineNumberAt } from "./_util.js";

// A tRPC mutation built on `publicProcedure` writes data with no auth in front
// of it. Mutations must stack a protected/authed procedure tier. (Auth from day
// one — public procedures are read-only-and-safe at most.)
//
// Heuristic: `publicProcedure` followed by `.mutation(` within the same chain
// window. Misses mutations split across reassigned builders; window-bounded to
// avoid pairing a public query with a distant unrelated mutation.
const ANCHOR = /publicProcedure[\s\S]{0,240}?\.mutation\s*\(/g;

export const publicProcedureMutation: Rule = {
  id: "public-procedure-mutation",
  title: "publicProcedure used on a mutation",
  severity: "critical",
  skillRef: "factory-auth.md §Auth from day one",
  languages: ["ts"],
  detectFile(file): Finding[] {
    const findings: Finding[] = [];
    const re = new RegExp(ANCHOR.source, ANCHOR.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(file.contents)) !== null) {
      findings.push({
        ruleId: this.id,
        severity: this.severity,
        file: file.path,
        line: lineNumberAt(file.contents, m.index),
        message: "mutation built on publicProcedure — use a protected/authed procedure tier",
        skillRef: this.skillRef,
      });
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    return findings;
  },
};
