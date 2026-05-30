import type { Finding, Rule } from "./types.js";
import { isTestFile, lineNumberAt } from "./_util.js";

// A hardcoded list of privileged emails is auth-as-config-in-source: it can't be
// rotated without a deploy, leaks identities in git history, and drifts from the
// real access model. Roles belong in the auth provider / DB, not an array.
//
// Heuristic (precision-first, tuned against real repos): flag an array whose
// elements are ALL bare email string-literals AND that is assigned to an
// identifier signalling access intent (admin / allow / whitelist / ...). This
// rejects arrays of objects that merely carry an email field, and recipient
// lists (e.g. a contact-form RECIPIENTS const) that aren't access control. Test
// fixtures are skipped — a hardcoded allowlist in a test is data, not config.
const PURE_EMAIL_ARRAY =
  /\[\s*(?:["'][^"'@\s]+@[^"'\s]+\.[^"'\s]+["']\s*,\s*)*["'][^"'@\s]+@[^"'\s]+\.[^"'\s]+["']\s*,?\s*\]/g;
const ACCESS_INTENT = /(allow|whitelist|admin|permit|superuser|authoriz|privileg)/i;
const PRECEDING_NAME = /([A-Za-z_$][\w$]*)\s*[:=]\s*$/;

export const hardcodedEmailAllowlist: Rule = {
  id: "hardcoded-email-allowlist",
  title: "Hardcoded email allowlist",
  severity: "critical",
  skillRef: "factory-auth.md §Hardcoded email allowlists",
  languages: ["ts"],
  detectFile(file): Finding[] {
    if (isTestFile(file.path)) return [];
    const findings: Finding[] = [];
    const re = new RegExp(PURE_EMAIL_ARRAY.source, PURE_EMAIL_ARRAY.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(file.contents)) !== null) {
      const prefix = file.contents.slice(Math.max(0, m.index - 48), m.index);
      const name = prefix.match(PRECEDING_NAME)?.[1] ?? "";
      if (ACCESS_INTENT.test(name)) {
        findings.push({
          ruleId: this.id,
          severity: this.severity,
          file: file.path,
          line: lineNumberAt(file.contents, m.index),
          message: `email allowlist "${name}" hardcoded in source — move access roles to the auth provider or DB`,
          skillRef: this.skillRef,
        });
      }
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    return findings;
  },
};
