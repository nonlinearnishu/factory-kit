import { describe, it, expect, vi, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import { walk } from "../walk.js";
import { collectFindings, hasBlocking, run } from "../runner.js";
import { rules } from "../rules/index.js";

const fixtures = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

const ALL_RULE_IDS = rules.map((r) => r.id);

describe("engine over fixtures", () => {
  it("flags every rule on the violations tree", async () => {
    const { files } = await walk(fixtures("violations"));
    const ids = new Set(collectFindings(files).map((f) => f.ruleId));
    for (const id of ALL_RULE_IDS) {
      expect(ids, `expected rule ${id} to fire`).toContain(id);
    }
  });

  it("blocks (exit 1) on the violations tree", async () => {
    const { files } = await walk(fixtures("violations"));
    expect(hasBlocking(collectFindings(files))).toBe(true);
  });

  it("is silent on the clean tree", async () => {
    const { files } = await walk(fixtures("clean"));
    expect(collectFindings(files)).toEqual([]);
  });

  it("honors disabledRules", async () => {
    const { files } = await walk(fixtures("violations"));
    const findings = collectFindings(files, new Set(["update-delete-no-where"]));
    expect(findings.some((f) => f.ruleId === "update-delete-no-where")).toBe(false);
    // other rules still fire
    expect(findings.some((f) => f.ruleId === "admin-client-module-scope")).toBe(true);
  });

  it("every finding cites a real-looking skillRef", async () => {
    const { files } = await walk(fixtures("violations"));
    for (const f of collectFindings(files)) {
      expect(f.skillRef, f.ruleId).toMatch(/^factory-[\w-]+\.md §/);
    }
  });

  it("classifies languages and skips non-code files", async () => {
    const result = await walk(fixtures("violations"));
    expect(result.files.every((f) => f.lang === "ts")).toBe(true);
    expect(result.scanned).toBeGreaterThan(0);
  });
});

describe("run (end-to-end, including report)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns exit code 1 on the violations tree", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await run({ targetDir: fixtures("violations") })).toBe(1);
  });

  it("returns exit code 0 on the clean tree", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await run({ targetDir: fixtures("clean") })).toBe(0);
  });
});
