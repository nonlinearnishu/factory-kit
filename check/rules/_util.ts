// Shared detection helpers. v0 is deliberately regex/line-heuristic — cheap,
// zero-dependency, no AST. Where a heuristic can false-positive, the rule that
// uses it documents the limitation at its call site.

export interface LineMatch {
  line: number; // 1-based
  text: string; // trimmed line contents
}

/** Test/spec/fixture files — security rules that flag config skip these. */
export function isTestFile(p: string): boolean {
  return /(^|\/)__tests__\//.test(p) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(p);
}

/** Per-line regex scan. Returns one match per line that matches `re`. */
export function regexLineMatches(contents: string, re: RegExp): LineMatch[] {
  const lines = contents.split(/\r?\n/);
  const out: LineMatch[] = [];
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i] ?? "";
    const probe = re.global ? new RegExp(re.source, re.flags) : re;
    if (probe.test(text)) out.push({ line: i + 1, text: text.trim() });
  }
  return out;
}

/** 1-based line number for a character offset into `contents`. */
export function lineNumberAt(contents: string, index: number): number {
  let line = 1;
  const stop = Math.min(index, contents.length);
  for (let i = 0; i < stop; i++) {
    if (contents[i] === "\n") line++;
  }
  return line;
}

/**
 * Scan for each occurrence of `anchor` and report it when `within` does NOT
 * appear in the window that follows (until a statement-end heuristic). Used by
 * the "X without Y in the same chain" rules. Heuristic: the window ends at the
 * first `;` or after `windowChars`, whichever comes first.
 */
export function anchorsMissingFollowup(
  contents: string,
  anchor: RegExp,
  within: RegExp,
  windowChars = 240
): number[] {
  const re = new RegExp(anchor.source, anchor.flags.includes("g") ? anchor.flags : anchor.flags + "g");
  const offsets: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(contents)) !== null) {
    const start = m.index;
    const semi = contents.indexOf(";", start);
    const end = semi === -1 ? Math.min(start + windowChars, contents.length) : Math.min(semi, start + windowChars);
    const window = contents.slice(start, end);
    const probe = new RegExp(within.source, within.flags);
    if (!probe.test(window)) offsets.push(start);
    if (re.lastIndex === start) re.lastIndex++; // guard against zero-width
  }
  return offsets;
}
