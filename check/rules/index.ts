import type { Rule } from "./types.js";
import { adminClientModuleScope } from "./admin-client-module-scope.js";
import { hardcodedEmailAllowlist } from "./hardcoded-email-allowlist.js";
import { publicProcedureMutation } from "./public-procedure-mutation.js";
import { updateDeleteNoWhere } from "./update-delete-no-where.js";
import { inMemoryRateLimiter } from "./in-memory-rate-limiter.js";
import { mixedTrpcServerActions } from "./mixed-trpc-server-actions.js";

// Manual registry — rules are registered explicitly, not auto-discovered, so the
// active set is always greppable and a new rule lands with intent. Each rule
// cites the factory-pitfalls.md entry it enforces.
export const rules: Rule[] = [
  adminClientModuleScope,
  hardcodedEmailAllowlist,
  publicProcedureMutation,
  updateDeleteNoWhere,
  inMemoryRateLimiter,
  mixedTrpcServerActions,
];

// Known pitfalls from factory-pitfalls.md not yet covered by a rule. Surfaced in
// the report footer so the tool never implies full coverage (no silent caps).
// TS: migrations-at-runtime, hex/raw-palette color, dark: on elements,
//     no-tests-under-src, commits-with-no-Linear-linkage.
// PY: pydantic-state-for-langgraph, routing-inline-in-add_conditional_edges,
//     pydantic-copied-across-entry-points, prebuilt-libs-before-second-consumer.
export const UNCOVERED = { ts: 5, py: 4 } as const;
