import type { Finding, Rule } from "./types.js";
import { anchorsMissingFollowup, lineNumberAt } from "./_util.js";

// A Drizzle `.update()` / `.delete()` with no `.where()` mutates every row in the
// table. This is the canonical data-loss footgun the ESLint Drizzle plugin
// guards against; we flag it statically too.
//
// Heuristic: anchor on a *direct* `db`/`tx`/`database`/`trx` method call —
// `db.delete(` / `db.update(` — then check the statement window for `.where(`.
// Anchoring on the db identifier immediately before the method avoids false
// positives from `Map.delete()` / `Set.delete()` and from the `db` in an import
// line. Will flag a genuinely table-wide delete (intended) and miss builders not
// named db/tx — an AST pass (ts-morph) is the documented later upgrade.
const ANCHOR = /\b(?:db|tx|trx|database)\s*\.\s*(?:update|delete)\s*\(/;
const WHERE = /\.where\s*\(/;

export const updateDeleteNoWhere: Rule = {
  id: "update-delete-no-where",
  title: "UPDATE/DELETE without WHERE",
  severity: "critical",
  skillRef: "factory-data-layer.md §ORM pick",
  languages: ["ts"],
  detectFile(file): Finding[] {
    const offsets = anchorsMissingFollowup(file.contents, ANCHOR, WHERE, 360);
    return offsets.map((index) => ({
      ruleId: this.id,
      severity: this.severity,
      file: file.path,
      line: lineNumberAt(file.contents, index),
      message: "update/delete with no .where() — this mutates every row in the table",
      skillRef: this.skillRef,
    }));
  },
};
