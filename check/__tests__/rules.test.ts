import { describe, it, expect } from "vitest";
import type { RepoFile } from "../rules/types.js";
import { adminClientModuleScope } from "../rules/admin-client-module-scope.js";
import { hardcodedEmailAllowlist } from "../rules/hardcoded-email-allowlist.js";
import { publicProcedureMutation } from "../rules/public-procedure-mutation.js";
import { updateDeleteNoWhere } from "../rules/update-delete-no-where.js";
import { inMemoryRateLimiter } from "../rules/in-memory-rate-limiter.js";
import { mixedTrpcServerActions } from "../rules/mixed-trpc-server-actions.js";

const f = (contents: string, path = "x.ts"): RepoFile => ({ path, contents, lang: "ts" });

// These pin the precision heuristics — the boundary between true and false
// positive is where a deterministic rule earns or loses trust.
describe("admin-client-module-scope", () => {
  it("flags a module-scope service-role client", () => {
    const out = adminClientModuleScope.detectFile!(
      f(`export const admin = createClient(url, process.env.SERVICE_ROLE_KEY!)`)
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.line).toBe(1);
  });
  it("ignores an anon client", () => {
    expect(adminClientModuleScope.detectFile!(f(`const c = createClient(url, ANON_KEY)`))).toEqual([]);
  });
  it("ignores a wrapped admin client (not module scope)", () => {
    const src = `function get() {\n  return createClient(url, process.env.SERVICE_ROLE_KEY!)\n}`;
    expect(adminClientModuleScope.detectFile!(f(src))).toEqual([]);
  });
});

describe("hardcoded-email-allowlist", () => {
  it("flags a pure-email array assigned to an access-intent name", () => {
    expect(
      hardcodedEmailAllowlist.detectFile!(f(`const ADMIN_EMAILS = ["a@b.com", "c@d.com"]`))
    ).toHaveLength(1);
    expect(hardcodedEmailAllowlist.detectFile!(f(`const allowlist = ["a@b.com"]`))).toHaveLength(1);
  });
  it("ignores an email array with no access-intent name (e.g. a recipients list)", () => {
    // The duezy dogfood lesson: `const RECIPIENTS = [...]` is not auth.
    expect(hardcodedEmailAllowlist.detectFile!(f(`const RECIPIENTS = ["a@b.com", "c@d.com"]`))).toEqual(
      []
    );
  });
  it("ignores an array of objects that merely contain email fields", () => {
    const src = `const owners = [{ name: "x", email: "o1@example.com" }, { name: "y", email: "o2@example.com" }]`;
    expect(hardcodedEmailAllowlist.detectFile!(f(src))).toEqual([]);
  });
  it("ignores test files even with a real allowlist", () => {
    expect(
      hardcodedEmailAllowlist.detectFile!(f(`const adminEmails = ["a@b.com"]`, "x.test.ts"))
    ).toEqual([]);
  });
});

describe("public-procedure-mutation", () => {
  it("flags publicProcedure.mutation", () => {
    expect(
      publicProcedureMutation.detectFile!(f(`publicProcedure.input(x).mutation(async () => {})`))
    ).toHaveLength(1);
  });
  it("ignores publicProcedure.query", () => {
    expect(publicProcedureMutation.detectFile!(f(`publicProcedure.query(async () => {})`))).toEqual([]);
  });
});

describe("update-delete-no-where", () => {
  it("flags db.delete without where", () => {
    expect(updateDeleteNoWhere.detectFile!(f(`await db.delete(users);`))).toHaveLength(1);
  });
  it("ignores db.delete with where", () => {
    expect(updateDeleteNoWhere.detectFile!(f(`await db.delete(users).where(eq(users.id, id));`))).toEqual(
      []
    );
  });
  it("ignores Map.delete (not a db chain)", () => {
    expect(updateDeleteNoWhere.detectFile!(f(`cache.delete(key);`))).toEqual([]);
  });
});

describe("in-memory-rate-limiter", () => {
  it("flags a rate-named module-scope Map", () => {
    expect(inMemoryRateLimiter.detectFile!(f(`const rateLimitHits = new Map()`))).toHaveLength(1);
  });
  it("ignores an unrelated Map", () => {
    expect(inMemoryRateLimiter.detectFile!(f(`const cache = new Map()`))).toEqual([]);
  });
});

describe("mixed-trpc-server-actions", () => {
  it("flags a repo with both server actions and tRPC", () => {
    const out = mixedTrpcServerActions.detectRepo!([
      f(`"use server";\nexport async function a() {}`, "actions.ts"),
      f(`const t = initTRPC.create();`, "trpc.ts"),
    ]);
    expect(out).toHaveLength(1);
  });
  it("ignores a tRPC-only repo", () => {
    expect(
      mixedTrpcServerActions.detectRepo!([f(`const t = initTRPC.create();`, "trpc.ts")])
    ).toEqual([]);
  });
});
