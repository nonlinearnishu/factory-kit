import { initTRPC } from "@trpc/server";
import { z } from "zod";

const t = initTRPC.create();
// CLEAN: mutation on a protected tier; no publicProcedure mutation, and the repo
// uses tRPC only (no server-action directive anywhere in this tree).
const protectedProcedure = t.procedure.use(({ next }) => next());

export const appRouter = t.router({
  createThing: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => ({ ok: true, name: input.name })),
});
