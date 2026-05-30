// The rule contract. Every finding cites a factory-pitfalls.md section by its
// owning skill — the citation is the product, not a nicety.

export type Severity = "critical" | "high" | "medium" | "low";

// Language tag drives the analyzer seam. v0 detection is regex/line-heuristic
// for both; the tag is what lets a per-language AST analyzer (ts-morph for ts,
// a Python `ast` sidecar for py) slot in later without touching rule call sites.
export type Lang = "ts" | "py";

export interface Finding {
  ruleId: string;
  severity: Severity;
  file: string; // repo-relative
  line?: number;
  message: string;
  skillRef: string; // e.g. "factory-auth.md §Admin client — always wrapped"
}

export interface RepoFile {
  path: string; // repo-relative
  contents: string;
  lang: Lang;
}

export interface Rule {
  id: string;
  title: string;
  severity: Severity;
  skillRef: string;
  languages: Lang[];
  // File-level rules implement detectFile; repo-level rules implement detectRepo.
  // The runner only ever hands a rule files whose lang is in `languages`.
  detectFile?(file: RepoFile): Finding[];
  detectRepo?(files: RepoFile[]): Finding[];
}
