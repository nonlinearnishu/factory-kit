import { db } from "./db";
import { eq } from "drizzle-orm";
import { things } from "./schema";

// CLEAN: every mutation is scoped by .where().
export async function remove(id: string) {
  return db.delete(things).where(eq(things.id, id));
}

export async function rename(id: string, name: string) {
  return db.update(things).set({ name }).where(eq(things.id, id));
}
