import { db } from "./db";
import { things } from "./schema";

// VIOLATION: delete/update with no .where() — table-wide mutation.
export async function wipe() {
  return db.delete(things);
}

export async function renameAll(name: string) {
  return db.update(things).set({ name });
}
