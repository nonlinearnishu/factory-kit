import { db } from "./db";
import { eq } from "drizzle-orm";
import { users } from "./schema";

// CLEAN: roles read from the DB, not a hardcoded email list.
export async function isAdmin(userId: string): Promise<boolean> {
  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return row?.role === "admin";
}
