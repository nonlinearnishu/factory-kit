import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import type { Lang, RepoFile } from "./rules/types.js";

const LANG_BY_EXT: Record<string, Lang> = {
  ".ts": "ts",
  ".tsx": "ts",
  ".js": "ts",
  ".jsx": "ts",
  ".mjs": "ts",
  ".cjs": "ts",
  ".py": "py",
};

const DEFAULT_IGNORES = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/out/**",
  "**/coverage/**",
  "**/.venv/**",
  "**/venv/**",
  "**/__pycache__/**",
  "**/*.min.js",
  "**/*.d.ts",
];

export interface WalkResult {
  files: RepoFile[];
  scanned: number; // files we read and classified
  skipped: number; // candidate files ignored (not a known code language)
}

function langFor(file: string): Lang | null {
  return LANG_BY_EXT[path.extname(file).toLowerCase()] ?? null;
}

// Approximate .gitignore awareness: fast-glob has no native support, so we read
// top-level .gitignore entries and fold them into the ignore set. Negations and
// nested gitignores are not handled — documented limitation, logged by callers.
function gitignorePatterns(targetDir: string): string[] {
  const file = path.join(targetDir, ".gitignore");
  if (!existsSync(file)) return [];
  const patterns: string[] = [];
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;
    const clean = line.replace(/^\/+/, "").replace(/\/+$/, "");
    if (!clean) continue;
    patterns.push(`**/${clean}/**`, `**/${clean}`);
  }
  return patterns;
}

export async function walk(targetDir: string): Promise<WalkResult> {
  const entries = await fg(["**/*"], {
    cwd: targetDir,
    dot: false,
    onlyFiles: true,
    followSymbolicLinks: false,
    suppressErrors: true,
    ignore: [...DEFAULT_IGNORES, ...gitignorePatterns(targetDir)],
  });

  const files: RepoFile[] = [];
  let skipped = 0;

  for (const rel of entries) {
    const lang = langFor(rel);
    if (!lang) {
      skipped++;
      continue;
    }
    try {
      const contents = await readFile(path.join(targetDir, rel), "utf8");
      files.push({ path: rel, contents, lang });
    } catch {
      skipped++;
    }
  }

  return { files, scanned: files.length, skipped };
}
