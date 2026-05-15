---
name: factory-auth
description: Auth and authorization conventions distilled across builds with three different auth stacks (Better Auth + orgs, Supabase Auth + RLS, Clerk). Covers the provider decision matrix, the unified wrapper interface (`requireAuth` / `requireRole` / `withOrgContext`), procedure tier stacking, session handling, OAuth callback safety, plugin composition with Better Auth, and the anti-patterns (hardcoded allowlists, admin client at module scope, triple-fallback auth surfaces).
---

# Factory auth

## Provider pick — decision matrix

| Provider | Pick when |
|---|---|
| **Better Auth + organization plugin** | Default. B2B with team/org concept. Drizzle-based projects. Need 2FA + magic link + admin out of the box. |
| **Supabase Auth + RLS** | RLS is doing real work — multi-role partner/distributor model, deeply branched authz at row level. Project already commits to Supabase. |
| **Clerk** | Consumer / SSO-heavy. Managed auth UI components matter. Org features secondary. |

The wrapper interface is the same regardless. Provider is a swap point, not a leak.

## The wrapper interface — single seam

```ts
// src/lib/auth/index.ts
export async function requireAuth(): Promise<{ user: User; session: Session }> {
  const session = await getSession();
  if (!session) throw new AuthError('unauthenticated');
  return { user: session.user, session };
}

export async function requireRole(role: Role): Promise<{ user: User; session: Session }> {
  const ctx = await requireAuth();
  if (!ctx.user.roles.includes(role)) throw new AuthError('forbidden');
  return ctx;
}

export async function withOrgContext<T>(
  fn: (ctx: { orgId: string; user: User }) => Promise<T>,
): Promise<T> {
  const { user, session } = await requireAuth();
  const orgId = session.activeOrganizationId;
  if (!orgId) throw new AuthError('no_org_context');
  return fn({ orgId, user });
}
```

Every server action / API route uses these — never the provider directly. When you swap providers, only the body of these wrappers changes.

## Procedure tier stacking (tRPC)

```ts
export const publicProcedure = t.procedure;                          // anyone
export const protectedProcedure = publicProcedure.use(requireAuth);  // authed user
export const orgProcedure = protectedProcedure.use(requireOrg);      // authed + org context
```

For server actions, the equivalent is the wrapper functions above called at the top of each action.

## Better Auth — plugin composition

```ts
// src/lib/auth.ts
import { betterAuth } from 'better-auth';
import { organization, admin, magicLink, twoFactor } from 'better-auth/plugins';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  plugins: [
    organization({ accessControl: customAC, roles: { owner, admin, member } }),
    admin(),
    magicLink({ sendMagicLink }),
    twoFactor(),
  ],
});
```

Custom access control via `accessControl` — define resource/action permissions explicitly, not roles inline.

## Org-scoped middleware

```ts
const requireOrg = async (opts: { ctx: Context }) => {
  const session = opts.ctx.session;
  if (!session) throw new TRPCError({ code: 'UNAUTHORIZED' });
  const orgId = session.activeOrganizationId;
  if (!orgId) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'no_org_context' });
  return { ...opts.ctx, orgId };
};
```

Every domain table has an `orgId` (or `workspaceId` / `projectId`) FK with `onDelete: 'cascade'`. Every query filters by it via the middleware-provided context.

## Auto-select organization

If the user belongs to exactly one org, auto-activate it on login. Custom hook on the client side:

```ts
export function useAutoSelectOrganization() {
  const { data: session } = useSession();
  const { data: orgs } = useOrganizations();
  useEffect(() => {
    if (session && !session.activeOrganizationId && orgs?.length === 1) {
      switchOrganization({ organizationId: orgs[0].id });
    }
  }, [session, orgs]);
}
```

Spares the user a meaningless click on the first session.

## Supabase RLS — when RLS earns its keep

For multi-role surfaces where the same query needs different behavior per audience (admin sees all, owner sees own distributor, rep sees facilities they have access to):

- Define RLS policies per table per role
- API layer is **auth-context-agnostic** — `listCasesWith(client)` takes a Supabase client, gets reused by admin queries (admin client, RLS bypassed) and RLS-scoped queries (anon/user client, RLS active)
- Auto-generated types via `supabase gen types typescript` — the schema is the source of truth

The trade-off: RLS adds latency on every query, and complex policies are hard to debug. Use only when the multi-role split is the dominant concern.

## Clerk — JWT verification + fallback user-linking

Clerk uses RS256-signed JWTs. Verify the signature on every API request — never trust unsigned claims:

```py
def verify_clerk_token(token: str) -> ClerkUser:
    jwks = fetch_jwks()  # cached
    payload = jwt.decode(token, jwks, algorithms=['RS256'])
    return ClerkUser(**payload)
```

If your webhook hasn't arrived but the user has a valid token, create the user record inline on first request. Don't 404 valid users:

```py
async def get_or_create_user(clerk_user: ClerkUser) -> User:
    user = await db.scalar(select(User).where(User.clerk_id == clerk_user.sub))
    if user:
        return user
    return await create_user_from_clerk(clerk_user)
```

## OAuth callback safety

```ts
function safeNext(next: string | null): string {
  if (!next) return '/';
  if (next.startsWith('//')) return '/';        // protocol-relative
  if (!next.startsWith('/')) return '/';        // not relative
  return next;
}

// OAuth callback skips ?next= for OAuth flows entirely
// (refresh-on-OAuth case is too easy to weaponize)
```

Apply in `/auth/callback`, login, signup-complete, magic-link-redirect — anywhere a URL comes from a query param.

## Role-conditional post-login redirect

Don't hardcode `/dashboard`. Look up the user's role and redirect:

```ts
const profile = await getProfile(user.id);
if (profile.role === 'admin') return redirect('/admin');
if (profile.role === 'rep') return redirect('/submit');
return redirect('/');
```

## Admin client bypass — always wrapped

```ts
// src/lib/supabase/admin.ts
export async function withAdmin<T>(fn: (admin: AdminClient) => Promise<T>): Promise<T> {
  await requireAdmin();           // verify caller is admin first
  return fn(createAdminClient());
}
```

Never export `createAdminClient` at the module top level — only behind `withAdmin`. See `factory-security.md`.

## What NOT to do

- **Don't hardcode email allowlists.** Move to a DB-backed members table from the start. Allowlist-in-config doesn't scale.
- **Don't put auth logic inline in routes.** Always through the wrapper interface.
- **Don't expose admin/service-role clients at module scope.** Wrap.
- **Don't stack three fallback auth paths** (e.g. JWT → session token → header fallback). Pick one provider per surface.
- **Don't trust unsigned JWT claims.** Always verify the signature.
- **Don't 404 valid users when the webhook hasn't arrived.** Fallback user-linking.
- **Don't skip `safeNext` validation on redirect params.** Open-redirect is a recurring bug class.
- **Don't put RLS in front of admin/internal queries.** Use the admin client for them (wrapped).

## Pitfalls referenced

- **Hardcoded email allowlist** for auth (encode/monorepo). Doesn't scale.
- **Triple-fallback auth surface** (cothon: Clerk → extension token → X-User-ID). Three things to test, three places to break.
- **Admin client at module scope.** Always wrap.
- **No auth at all** (ford-analysis: every procedure `publicProcedure`). Even single shared password is better.

## Source patterns

Kairos (Supabase Auth + RLS, multi-role partner-distributor, auth-context-agnostic API, `safeNext`, role-conditional redirect, admin client wrapping, RowActions auth gating), duezy (Better Auth + organization plugin, session timeout provider, custom org-based ACL, dual mode forms with auth context), fleet-advisor (procedure tier stacking, Better Auth plugin composition, auto-select organization), cothon (Clerk JWT verification with fallback user-linking, context propagation via request.state, multi-tenant context dataclasses), encode/monorepo (NextAuth allowlist anti-pattern).
