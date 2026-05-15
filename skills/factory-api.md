---
name: factory-api
description: API conventions for both server actions and tRPC builds. Covers the decision between them, per-mutation Zod input schemas, central router composition, pagination shape, multi-field search via Drizzle `ilike` + `or()`, mutation lifecycle hooks, conditional query enabling, stale-time defaults, error response shape and custom error class taxonomy, mutation-boundary audit logging, fetch adapter for tRPC routes. Read when designing or implementing any data-mutation endpoint.
---

# Factory api

## API style — decision matrix

| Style | Pick when |
|---|---|
| **Server actions** | Default. Feature-folder colocation matters. One frontend consumer. App-internal API only. Pairs with TanStack Query `useMutation`. |
| **tRPC** | ≥3 entities with cross-feature queries. Multiple frontend consumers. Need typed RPC across a real network boundary. |
| **REST / OpenAPI** | Only when an external system needs to call you. Don't use for internal app traffic. |

**Don't import both tRPC and use server actions in the same project.** Pick a side at project start.

## Server actions — canonical shape

```ts
// features/customers/actions.ts
'use server';

import { customerInputSchema } from './schema';
import { requireAuth, withOrgContext } from '@/lib/auth';
import { db } from '@/db';
import { customers } from '@/db/schema';
import { logAdminAction } from '@/lib/admin/activity';

export async function createCustomer(input: unknown): Promise<ActionResult<Customer>> {
  const parsed = customerInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  return withOrgContext(async ({ orgId, user }) => {
    const [customer] = await db.insert(customers).values({
      ...parsed.data,
      orgId,
    }).returning();

    logAdminAction({ action: 'customer.create', subject_id: customer.id, actor_id: user.id })
      .catch((err) => console.error('audit log failed', err));

    return { data: customer };
  });
}

type ActionResult<T> = { data: T; error?: never } | { error: string; data?: never };
```

Result type is a discriminated union — client checks `if ('error' in result)`.

## TanStack Query hook wrapping the action

```ts
// features/customers/hooks.ts
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCustomer } from './actions';

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}
```

Invalidate at the 2-segment query-key prefix (`['customers']`) — invalidates both list and detail queries.

## tRPC — central router composition

```ts
// src/server/api/root.ts
export const appRouter = createTRPCRouter({
  customers: customersRouter,
  vehicles: vehiclesRouter,
  invoices: invoicesRouter,
  // explicit naming, manual registration — no automagic
});

export type AppRouter = typeof appRouter;
```

No automagic. New domain → add a line. Easy to grep, easy to see the full surface area.

## Procedure tiers — stacked

```ts
export const publicProcedure = t.procedure;
export const protectedProcedure = publicProcedure.use(requireAuthMiddleware);
export const orgProcedure = protectedProcedure.use(requireOrgMiddleware);
```

See `factory-auth.md` for the middleware shapes.

## Per-mutation Zod input

Every mutation / query has a dedicated Zod schema:

```ts
const createCustomerInput = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  // ...
});

export const customersRouter = createTRPCRouter({
  create: orgProcedure
    .input(createCustomerInput)
    .mutation(async ({ ctx, input }) => {
      // ctx.orgId is set by middleware
      const [customer] = await ctx.db.insert(customers).values({
        ...input,
        orgId: ctx.orgId,
      }).returning();
      return customer;
    }),
});
```

Schemas live next to the router, not in a separate file (unless shared with the client form).

## Pagination — limit/offset/orderBy

```ts
const listInput = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  orderBy: z.enum(['createdAt', 'updatedAt', 'name']).default('createdAt'),
  orderDir: z.enum(['asc', 'desc']).default('desc'),
});

list: orgProcedure.input(listInput).query(async ({ ctx, input }) => {
  return ctx.db.select().from(customers)
    .where(eq(customers.orgId, ctx.orgId))
    .limit(input.limit)
    .offset(input.offset)
    .orderBy(input.orderDir === 'desc' ? desc(customers[input.orderBy]) : asc(customers[input.orderBy]));
});
```

Cursor pagination only if you actually need it (real-time feeds, append-only logs). Offset pagination is fine for almost everything else.

## Multi-field search — `ilike` + `or()`

```ts
import { ilike, or, and, eq } from 'drizzle-orm';

const searchTerm = `%${input.q}%`;
const results = await ctx.db.select().from(customers).where(
  and(
    eq(customers.orgId, ctx.orgId),
    or(
      ilike(customers.name, searchTerm),
      ilike(customers.email, searchTerm),
      ilike(customers.phone, searchTerm),
    ),
  ),
);
```

For larger projects, move to Postgres full-text search (`tsvector` + `tsquery`) — but `ilike` is fine until volume forces the upgrade.

## Aggregated stats in list queries

Don't make a second round-trip for counts:

```ts
list: orgProcedure.input(listInput).query(async ({ ctx, input }) => {
  return ctx.db
    .select({
      ...getTableColumns(customers),
      vehicleCount: count(vehicles.id),
      chargerCount: count(chargers.id),
    })
    .from(customers)
    .leftJoin(vehicles, eq(vehicles.customerId, customers.id))
    .leftJoin(chargers, eq(chargers.customerId, customers.id))
    .where(eq(customers.orgId, ctx.orgId))
    .groupBy(customers.id);
});
```

For N+1-prone aggregations on detail views, use a subquery (see `factory-data-layer.md`).

## Mutation lifecycle hooks

Always specify `onSuccess` and let the global error boundary handle errors:

```tsx
const createMutation = useMutation({
  mutationFn: createCustomer,
  onSuccess: (result) => {
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    toast.success('Customer created');
    setMode({ kind: 'closed' });
    qc.invalidateQueries({ queryKey: ['customers'] });
  },
});
```

For server actions with `ActionResult<T>` shape, error-handling lives in `onSuccess` (the discriminated-union check). For tRPC mutations, errors throw — handle via `onError` or React Error Boundary.

## Conditional query enabling

```ts
const { data } = useQuery({
  queryKey: ['vehicle', 'list', { fleetId }],
  queryFn: () => listVehicles({ fleetId }),
  enabled: !!fleetId,
});
```

Required pattern when one query depends on another's result.

## Stale time defaults

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,          // 1 minute default — covers most cases
      gcTime: 5 * 60_000,         // 5 minute default
      retry: 1,
    },
  },
});
```

For stable reference data (states, vehicle types, country list), bump to 3-5 minutes per-query. Don't reach for `staleTime: Infinity` — invalidation is the safety net.

## Error response shape

Consistent across all endpoints:

```ts
type ApiError = {
  code: 'unauthenticated' | 'forbidden' | 'not_found' | 'validation_failed' | 'conflict' | 'internal';
  message: string;
  details?: unknown;
};
```

For server actions, return `{ error: 'message' }`. For tRPC, throw `TRPCError({ code, message })`. Client converts both to the same `ApiError` shape for display.

## Custom error class taxonomy

```ts
// src/lib/errors.ts
export class AuthError extends Error {
  constructor(public reason: 'unauthenticated' | 'forbidden') {
    super(reason);
  }
}

export class NotFoundError extends Error {
  constructor(public resource: string) {
    super(`${resource} not found`);
  }
}

export class ValidationError extends Error {
  constructor(public issues: { field: string; message: string }[]) {
    super('validation_failed');
  }
}
```

Throw these from server-side code. Catch at the route handler / server action boundary; convert to `ApiError` shape for the client.

## Audit logging at mutation boundary

```ts
// fire-and-forget — never block the mutation
logAdminAction({
  action: 'customer.update',
  subject_id: customerId,
  actor_id: userId,
  metadata: { fields_changed: Object.keys(input) },
}).catch((err) => console.error('audit log failed', err));
```

Log actions and IDs. Never log raw payloads — see `factory-security.md`.

## Fetch adapter for tRPC routes (App Router)

```ts
// app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/api/root';
import { createTRPCContext } from '@/server/api/trpc';

const handler = (req: Request) => fetchRequestHandler({
  endpoint: '/api/trpc',
  req,
  router: appRouter,
  createContext: () => createTRPCContext({ req }),
});

export { handler as GET, handler as POST };
```

Same handler for GET and POST. Don't write per-route handlers.

## What NOT to do

- **Don't mix tRPC and server actions in the same project.** Pick a side.
- **Don't write per-route HTTP handlers when tRPC exists.** The fetch adapter is the surface.
- **Don't `update` or `delete` without `where`.** ESLint Drizzle rules from `factory-data-layer.md`.
- **Don't await audit logs on the mutation critical path.** Fire-and-forget.
- **Don't unify server input and client form schemas.** Per-context variants (see `factory-forms.md`).
- **Don't return raw `Error` objects.** Convert to the `ApiError` shape at the boundary.
- **Don't make every endpoint `publicProcedure`** — even internal tools deserve auth from day one.
- **Don't paginate with cursor unless you actually need it.** Offset is fine for almost everything.

## Pitfalls referenced

- **Mixed tRPC + server actions** (encode/monorepo imported tRPC and never used it).
- **No auth on procedures** (ford-analysis: every procedure `publicProcedure`).
- **Two-way state-DB sync** (fleet-advisor's RouteContext + auto-persist hook) can desync.

## Source patterns

Fleet-advisor (procedure tier stacking, central router composition, per-mutation Zod, aggregated stats in list queries, conditional query enabling, stale-time configuration, fetch adapter), kairos (server-action shape with discriminated-union result, useTransition wrapper, query-key naming, fire-and-forget audit logging, custom error classes), duezy (tRPC with org context, batch link with superjson, 60s default stale), encode/monorepo (custom error class taxonomy: DatabaseError, AuthError, NotFoundError, UnauthorizedError), cothon (COUNT subquery to avoid N+1, cursor pagination for chat messages).
