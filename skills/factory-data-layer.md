---
name: factory-data-layer
description: Database schema, ORM, and migration conventions across builds. Drizzle as default with domain-partitioned schema modules, shared `timestamps` helper, multi-tenancy keys with cascade delete, `pgTableCreator` prefixing, JSONB for flexible attributes, schema-derived type exports, polymorphic table patterns, ESLint Drizzle rules. Covers when to escape to raw SQL or Supabase auto-types.
---

# Factory data layer

## ORM pick — decision matrix

| ORM | Pick when |
|---|---|
| **Drizzle** | Default. Postgres + TypeScript. Type-safe queries. Pairs with Better Auth's `drizzleAdapter`. |
| **Supabase auto-generated types** | Project commits to Supabase Auth + RLS heavily. RLS does real work. |
| **SQLAlchemy (Python)** | Python service with relational data. Use with soft-delete mixin. |
| **Raw `pg`** | Never for new projects. Migrate if encountered. |

## Domain-partitioned schema modules

Don't put the whole schema in one file. Partition by domain:

```
src/server/db/schemas/
├── _shared.ts           # timestamps helper, pgTableCreator
├── auth.ts              # users, sessions, accounts, verifications
├── <domain>.ts          # e.g. fleet.ts, payments.ts, analytics.ts
├── reference.ts         # lookup tables (countries, states)
└── index.ts             # re-exports all
```

Each file is independently grep-able and reviewable.

## `_shared.ts` — table creator + timestamps

```ts
import { pgTableCreator, timestamp } from 'drizzle-orm/pg-core';

// Prefix tables so the schema can share a DB with other apps
export const pgTable = pgTableCreator((name) => `myapp_${name}`);

// Reusable timestamps spread into every table definition
export const timestamps = {
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
};
```

Use in domain files:

```ts
export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  ...timestamps,
});
```

## Multi-tenancy keys — universal FK with cascade delete

Every domain table has `orgId` (or `workspaceId` / `projectId`) FK with `onDelete: 'cascade'`. Deleting an org cleans up all owned rows automatically.

The org middleware (see `factory-auth.md`) injects `orgId` into the request context; every query filters by it.

## Custom attributes as JSONB

For per-row flexible attributes the schema doesn't know about (customer-specific tags, configurable workflows):

```ts
customAttributes: jsonb('custom_attributes').$type<Record<string, unknown>>().default({}),
```

**Rule:** what drives queries gets a real column. What doesn't drives goes here. Don't query inside JSONB at app speed.

## Polymorphic table pattern

When you have entities that share a base type but diverge (ICE vehicles vs BEV vehicles, individual vs business accounts):

```ts
export const vehicleTypes = pgTable('vehicle_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  make: text('make').notNull(),
  model: text('model').notNull(),
  // shared fields
});

export const iceVehicles = pgTable('ice_vehicles', {
  id: uuid('id').defaultRandom().primaryKey(),
  vehicleTypeId: uuid('vehicle_type_id').references(() => vehicleTypes.id).notNull(),
  // ICE-specific fields (fuel type, MPG, etc.)
});

export const bevVehicles = pgTable('bev_vehicles', {
  id: uuid('id').defaultRandom().primaryKey(),
  vehicleTypeId: uuid('vehicle_type_id').references(() => vehicleTypes.id).notNull(),
  replacingIceVehicleId: uuid('replacing_ice_vehicle_id').references(() => iceVehicles.id),
  // BEV-specific fields (battery kWh, charger type, etc.)
});
```

Shared base + variant tables — keeps queries explicit, avoids nullable-column proliferation.

## Schema-derived type exports

```ts
// src/db/index.ts
export type CustomerTable = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
```

Re-export from one entry point. Never define `interface Customer {}` separately — the schema is the source of truth.

## Soft-delete (Python / SQLAlchemy)

```py
class SoftDeleteMixin:
    deleted_at = Column(DateTime, nullable=True)

class Customer(Base, SoftDeleteMixin):
    __tablename__ = 'customers'
    # ...

# Queries always filter
stmt = select(Customer).where(Customer.deleted_at.is_(None))
```

For TypeScript / Drizzle: add `deletedAt: timestamp('deleted_at')` and remember to add `where(isNull(table.deletedAt))` to every read. Wrap it in a base query helper if you can.

## InferSelectModel for typed selects

```ts
import type { InferSelectModel } from 'drizzle-orm';
type Customer = InferSelectModel<typeof customers>;
```

Same pattern, different syntax. Use whichever the project consistently uses.

## Migrations — CI, not runtime

```sh
# Local dev — apply schema directly during prototyping
drizzle-kit push

# Pre-merge — generate migration files
drizzle-kit generate

# CI — apply migrations against the ephemeral Neon branch DB
drizzle-kit migrate
```

Never run migrations at app startup. Never run them inside a Cloud Run container's CMD.

## Migration file naming — one convention, stick

Either timestamps (`20260514_create_customers.sql`) or sequential numbers (`0001_create_customers.sql`). Don't mix `0000_create_simulations.ts` with `add_vehicle_description.ts` — schema evolution order becomes hard to read.

## Database environment switching (Vercel)

For repos that connect to Postgres via Neon and use Vercel preview deployments:

```ts
// src/db/index.ts
const isPreview = process.env.VERCEL_ENV === 'preview';
const isProduction = process.env.VERCEL_ENV === 'production';

if (isPreview && process.env.DATABASE_URL === process.env.PROD_DATABASE_URL) {
  throw new Error('Preview deployment must not use prod DB');
}
```

Forces a configuration mistake to fail loud at boot instead of silently writing preview data to prod.

## ESLint Drizzle rules

The official `eslint-plugin-drizzle` enforces WHERE clauses on UPDATE/DELETE:

```js
// eslint.config.js
{
  rules: {
    'drizzle/enforce-delete-with-where': 'error',
    'drizzle/enforce-update-with-where': 'error',
  },
}
```

Saves you from accidentally `update(customers).set({...})` (without `where`), which would update every row.

## Activity log table — fire-and-forget at mutation

```ts
export const adminActions = pgTable('admin_actions', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: uuid('actor_id').notNull(),
  action: text('action').notNull(),
  subjectType: text('subject_type'),
  subjectId: uuid('subject_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export async function logAdminAction(input: NewAdminAction): Promise<void> {
  try {
    await db.insert(adminActions).values(input);
  } catch (err) {
    console.error('audit log failed', err);
  }
}
```

Never `await` audit-log success on the critical path of a mutation. See `factory-security.md`.

## What NOT to do

- **Don't put the whole schema in one file.** Partition by domain.
- **Don't `update` or `delete` without `where`.** Use the ESLint rule.
- **Don't run migrations at runtime.** CI job.
- **Don't query inside JSONB at app speed.** Promote to column.
- **Don't mix migration-file naming conventions** in the same project.
- **Don't define entity types separately.** Use `$inferSelect` / `InferSelectModel`.
- **Don't skip `onDelete: 'cascade'`** on tenant-keyed FKs. Cleanup is the whole point.
- **Don't allow preview deploys to write to prod DB.** Boot-time assertion.

## Pitfalls referenced

- **Mixed migration-file naming** (ford-analysis). Pick one and stick.
- **Raw SQL with hand-mapped row-to-object** (encode/monorepo). Verbose, error-prone, no type inference.
- **Multiple progress-calculator files** (duezy) accumulating without deletion. When you write a unifier, delete the inputs in the same PR.

## Source patterns

Fleet-advisor (`_shared.ts`, `timestamps`, domain-partitioned schemas, `pgTableCreator`, cascade-delete, ESLint Drizzle rules, custom attributes JSONB), duezy (Drizzle relations with `InferSelectModel`, RDS IAM auth, lazy DB singleton via Proxy), ford-analysis (polymorphic vehicle tables, `$inferSelect` / `$inferInsert` exports, Vercel preview-DB safety check, time-series JSONB envelope), cothon (SoftDelete mixin with SQLAlchemy, async session management), kairos (admin_actions table, fire-and-forget audit log, Supabase auto-types).
