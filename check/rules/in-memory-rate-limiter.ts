import type { Finding, Rule } from "./types.js";
import { lineNumberAt } from "./_util.js";

// A rate limiter backed by an in-process Map is per-instance state. On serverless
// (the locked deploy target) every cold start and every concurrent lambda gets
// its own empty map — the limit is silently never enforced. State must live in a
// shared store (Redis/Upstash/DB).
//
// Heuristic: a top-level `const <name> = new Map(` where the name signals
// rate-limiting intent. Name-based, so low recall (misses object-literal stores
// and named libs configured with a memory driver) — documented.
const ANCHOR =
  /(^|\n)(export\s+)?const\s+(\w*(?:rate|limit|throttle|attempt|request|hit)\w*)\s*=\s*new\s+Map\s*(?:<[^>]*>)?\s*\(/gi;

export const inMemoryRateLimiter: Rule = {
  id: "in-memory-rate-limiter",
  title: "In-memory rate limiter on serverless",
  severity: "high",
  skillRef: "factory-security.md §Rate limiting",
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
        line: lineNumberAt(file.contents, m.index + (m[1] === "\n" ? 1 : 0)),
        message: `in-memory Map "${m[3]}" as a rate-limit store — per-instance on serverless, use a shared store`,
        skillRef: this.skillRef,
      });
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    return findings;
  },
};
