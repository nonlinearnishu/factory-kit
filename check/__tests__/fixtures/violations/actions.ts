"use server";

// Presence of a server action alongside the tRPC router (trpc-router.ts) is what
// trips the repo-level mixed-trpc-server-actions rule.
export async function createPost(formData: FormData): Promise<{ ok: boolean }> {
  return { ok: Boolean(formData) };
}
