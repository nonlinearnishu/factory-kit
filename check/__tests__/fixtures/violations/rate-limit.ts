// VIOLATION: in-memory rate-limit store on serverless.
const rateLimitHits = new Map<string, number>();

export function allow(ip: string): boolean {
  const n = rateLimitHits.get(ip) ?? 0;
  rateLimitHits.set(ip, n + 1);
  return n < 100;
}
