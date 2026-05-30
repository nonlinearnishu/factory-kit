import { readFile } from "node:fs/promises";
import path from "node:path";

// Optional per-repo config, read from the *target* repo. The only knob in v0 is
// disabling rules. The runner reports how many are disabled — the dogfood gate
// from the thesis: if >4 of the set get disabled, the rule design is wrong, not
// the repo.
export interface CheckConfig {
  disabledRules: Set<string>;
}

const CONFIG_FILE = ".factory-check.json";

export async function loadConfig(targetDir: string): Promise<CheckConfig> {
  try {
    const raw = await readFile(path.join(targetDir, CONFIG_FILE), "utf8");
    const parsed = JSON.parse(raw) as { disabledRules?: unknown };
    const disabled = Array.isArray(parsed.disabledRules)
      ? parsed.disabledRules.filter((x): x is string => typeof x === "string")
      : [];
    return { disabledRules: new Set(disabled) };
  } catch {
    return { disabledRules: new Set() };
  }
}
