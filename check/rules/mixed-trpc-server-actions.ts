import type { Finding, Rule } from "./types.js";

// Server actions and tRPC are two answers to the same question (how the client
// mutates the server). A repo running both fractures the mutation surface:
// validation, auth tiering, and error shape get implemented twice and drift.
// Pick one. (Repo-level — emits a single finding for the whole tree.)
//
// Heuristic: presence of a `"use server"` directive anywhere AND tRPC router
// markers anywhere. A repo deliberately migrating between the two will trip this
// — that is the intended signal, not a false positive.
const USE_SERVER = /["']use server["']/;
const TRPC = /\b(initTRPC|createTRPCRouter|publicProcedure|protectedProcedure)\b/;

export const mixedTrpcServerActions: Rule = {
  id: "mixed-trpc-server-actions",
  title: "Mixed tRPC + server actions",
  severity: "high",
  skillRef: "factory-api.md §API style — pick one",
  languages: ["ts"],
  detectRepo(files): Finding[] {
    const serverActionFile = files.find((f) => USE_SERVER.test(f.contents));
    const trpcFile = files.find((f) => TRPC.test(f.contents));
    if (!serverActionFile || !trpcFile) return [];
    return [
      {
        ruleId: this.id,
        severity: this.severity,
        file: trpcFile.path,
        message: `repo mixes server actions (e.g. ${serverActionFile.path}) with tRPC (e.g. ${trpcFile.path}) — pick one mutation surface`,
        skillRef: this.skillRef,
      },
    ];
  },
};
