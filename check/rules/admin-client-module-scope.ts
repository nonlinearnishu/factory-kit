import type { Finding, Rule } from "./types.js";
import { lineNumberAt } from "./_util.js";

// A service-role / admin client built at module scope is reachable by anything
// that imports the module — it bypasses RLS with no auth gate in front of it.
// The convention is: admin clients are always wrapped in a function, never a
// top-level singleton.
//
// Heuristic: a top-level `const x = createClient(` (the `const` sits in column 0,
// so it is module scope, not nested in a function) whose call window references
// a service-role key. Misses admin clients from other libs or assigned without
// `const` — documented low-recall tradeoff; precision is favored here.
const ANCHOR = /(^|\n)(export\s+)?const\s+\w+\s*=\s*createClient\s*\(/g;
const SERVICE_ROLE = /service_role|SERVICE_ROLE/;

export const adminClientModuleScope: Rule = {
  id: "admin-client-module-scope",
  title: "Admin client instantiated at module scope",
  severity: "critical",
  skillRef: "factory-auth.md §Admin client — always wrapped",
  languages: ["ts"],
  detectFile(file): Finding[] {
    const findings: Finding[] = [];
    const re = new RegExp(ANCHOR.source, ANCHOR.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(file.contents)) !== null) {
      const window = file.contents.slice(m.index, m.index + 320);
      if (SERVICE_ROLE.test(window)) {
        findings.push({
          ruleId: this.id,
          severity: this.severity,
          file: file.path,
          line: lineNumberAt(file.contents, m.index + (m[1] === "\n" ? 1 : 0)),
          message: "service-role client created at module scope — wrap it in a function behind an auth gate",
          skillRef: this.skillRef,
        });
      }
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    return findings;
  },
};
