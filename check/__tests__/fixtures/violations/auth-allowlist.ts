// VIOLATION: hardcoded email allowlist.
export const ADMIN_EMAILS = ["alice@acme.com", "bob@acme.com"];

export function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email);
}
