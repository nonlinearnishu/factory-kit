import { initTRPC } from "@trpc/server";
import { z } from "zod";

const t = initTRPC.create();
export const publicProcedure = t.procedure;

// VIOLATION: mutation built on publicProcedure (no auth tier).
export const appRouter = t.router({
  createThing: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => ({ ok: true, name: input.name })),
});
