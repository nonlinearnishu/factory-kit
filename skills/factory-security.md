---
name: factory-security
description: Security conventions for builds that touch sensitive data, regulated industries, or AI-generated code paths. Covers KMS encryption at rest, BAA verification for PHI in email/SMS, safe URL redirects, admin-client bypass guardrails, in-memory rate-limiter caveats, the "read-only by default" stance for AI-generated code, mandatory-review-queue pattern, and request tracing for support workflows.
---

# Factory security

## Sensitive data at rest

For SSN, government IDs, full PHI fields, financial account numbers:

```ts
// Encrypt on write
const encryptedSSN = await kms.encrypt(plaintext, {
  keyId: KMS_KEY_ID,
  context: { userId },
});
await db.update(users).set({ ssnEncrypted: encryptedSSN }).where(eq(users.id, userId));

// Decrypt on read — only in the handler that actually needs plaintext
const plaintext = await kms.decrypt(user.ssnEncrypted, { context: { userId } });

// Mask for display — never decrypt for display surfaces
const masked = `***-**-${plaintext.slice(-4)}`;
```

**Encryption context** (`{ userId }`) is bound to the ciphertext — KMS refuses to decrypt with a different context. Prevents row-shuffling attacks.

## PHI in email/SMS — BAA required

If a project emails or texts content that could include PHI (charge sheets, lab results, scheduling), **verify the provider has a BAA with the customer**. Resend has a BAA option; ensure it's signed before production.

Promote BAA checks from comments to runtime:

```ts
// In src/lib/email/resend.ts
if (process.env.RESEND_BAA_SIGNED !== 'true' && containsPHI(message)) {
  throw new Error('Cannot send PHI without signed BAA. Set RESEND_BAA_SIGNED=true after confirmation.');
}
```

Comments don't enforce; runtime assertions do.

## Safe URL redirects

OAuth `next=` params and similar redirect inputs are an open redirect bug class. Validate:

```ts
function safeNext(next: string | null): string {
  if (!next) return '/';
  if (next.startsWith('//')) return '/';     // protocol-relative
  if (!next.startsWith('/')) return '/';     // not relative
  return next;
}
```

Apply in OAuth callbacks, login redirects, post-signup redirects, and any place a URL comes in from a query param.

## Admin-client bypass

Supabase admin client (or any service-role / RLS-bypass client) is dangerous. Wrap every use:

```ts
export async function withAdmin<T>(
  fn: (admin: AdminClient) => Promise<T>,
): Promise<T> {
  await requireAdmin();           // verify caller is admin first
  return fn(createAdminClient());
}
```

**Never expose the admin client at module scope** — always behind a function that takes an auth check first.

## Rate limiting — single-instance is not horizontal

In-memory rate limiters work for single-server / single-region setups only. On Vercel, AWS Lambda, or any serverless runtime, each invocation has its own memory — the limiter doesn't work across instances.

For production: Upstash Redis with `@upstash/ratelimit`.

```ts
const ratelimit = new Ratelimit({
  redis: new Redis({ url: process.env.UPSTASH_URL, token: process.env.UPSTASH_TOKEN }),
  limiter: Ratelimit.fixedWindow(10, '60 s'),
});

const { success } = await ratelimit.limit(`${bucket}:${subject}`);
if (!success) throw new RateLimitError();
```

In-memory rate limiters are acceptable for prototype phase only. Migrate before scaling.

## AI-generated code — read-only by default

Per Veracode, ~45% of AI-generated code has vulnerabilities. Mitigations at the harness layer:

1. **Read-only by default.** Database connections, file system access, external APIs default to read-only. Write access is opt-in per feature and surfaces in the review queue.
2. **Mandatory review before prod.** No code path that mutates production data ships without explicit human approval. Lift from the Stripe Minions Blueprint / Cursor PR-flow pattern.
3. **Version snapshots.** Every AI-generated change has a "last working" rollback target. A versioned blob is enough.
4. **Token budget per customer.** Per-customer cap on agent invocations to prevent runaway loops.

This is the explicit differentiator vs. consumer vibe-coding tools (Lovable, Replit, v0). The harness's job is to make AI-generated code *safe to ship*.

## Auth surface

- **Never hardcode allowlists in code.** Move to a `users` / `members` table with role from the start. Allowlist-in-config doesn't scale past 10 entries.
- **Always validate JWT signatures** (Clerk uses RS256). Never trust unsigned claims.
- **Fallback user-linking on first request** — if your webhook hasn't arrived but the user has a valid token, create the user record inline. Don't 404 valid users.

## Secrets management

- **Never commit secrets.** Use env vars validated through `t3-oss/env-nextjs`.
- **Credential vault** at the customer-deployed harness level: AWS Secrets Manager or GCP Secret Manager. Customer secrets never live in this kit's repo.
- **RDS IAM authentication** for AWS DBs: rotates every 14 minutes; no long-lived password.

## Logging — don't log sensitive data

Audit logs should record *what* happened, not *the full payload*:

- **Log:** `{ user_id, action: 'updated_ssn', timestamp }`
- **Don't log:** `{ user_id, action: 'updated_ssn', old_value: '123-45-6789' }`

PII in logs creates compliance scope creep — logs end up needing the same protection as the source database. Redact at the logger layer if you can't avoid it at the call site.

## Request tracing

Per-request trace ID. Attach in middleware, propagate through downstream calls, surface in response headers:

```py
@app.middleware("http")
async def trace_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response
```

When something breaks at a customer, the trace ID is what unblocks the support conversation. Log it everywhere.

## Activity / audit logging — fire-and-forget at the mutation boundary

```ts
export async function updateFoo(input: FooUpdateInput) {
  await requireAuth();
  const updated = await db.update(foo).set(input).where(eq(foo.id, input.id)).returning();

  // Fire-and-forget — swallow errors so the mutation succeeds
  logAdminAction({ action: 'foo.update', subject_id: input.id, actor_id: user.id })
    .catch((err) => console.error('audit log failed', err));

  return updated;
}
```

Audit logs should never fail the user's action. Log delivery is best-effort; surface failures to ops, not to users.

## What NOT to do

- **Don't decrypt sensitive fields at API boundaries "just in case."** Decrypt at the specific handler that actually returns plaintext; mask everywhere else.
- **Don't expose the admin client as a top-level import.** Wrap in `withAdmin()` so the auth check is unavoidable.
- **Don't ship a feature without a review queue if it mutates customer data.** Vibe-coding incidents (Base44, Replit prod-DB wipe, Cursor RCE) are public examples of why.
- **Don't use in-memory rate limiting in production on serverless.** It silently doesn't work across instances.
- **Don't log raw PII or payloads.** Log actions and IDs; if you need the payload to debug, redact at the logger layer.
- **Don't hardcode allowlists.** Move to a DB table the moment there's a second entry.
- **Don't fail mutations on audit-log delivery.** Fire-and-forget; surface failures to ops.

## Pitfalls referenced

- **In-memory rate limiter shipped to prod** acknowledged-in-comment-but-not-fixed (kairos). Migrate to Upstash before scaling.
- **BAA comment instead of runtime check** in the email helper (kairos). Promote to assertion.
- **Hardcoded email allowlist** (encode/monorepo). DB-backed members table from the start.
- **Admin client at module scope** is easy to misuse. Always wrap.
- **No auth at all** in an internal-tool repo (ford-analysis: every procedure is `publicProcedure`). Even single shared password is better than nothing.

## Source patterns

Kairos (safeNext, admin-client wrapping, in-memory rate limit acknowledgement, BAA comment, activity logging), duezy (KMS for SSN, RDS IAM auth, encrypted-at-rest pattern), cothon (request logging middleware, JWT verification with fallback user linking, soft-delete mixin), encode/monorepo (email allowlist anti-pattern), Obsidian software-factory-idea (AI-code-risk stance, read-only-by-default, mandatory review queue).
