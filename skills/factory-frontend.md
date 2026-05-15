---
name: factory-frontend
description: Frontend conventions distilled across builds. CRUD shape (DataTable + drawer with mode union), RowActions primitive, format helpers, heading tiers, semantic color tokens, query-key naming, component-library decision criteria (Mantine vs shadcn). Read when scaffolding any UI surface that touches lists, forms, or entity editing.
---

# Factory frontend

## CRUD shape — DataTable + drawer with mode union

Default shape for any "list of entities, click to edit, button to create" surface. The drawer mode is a tagged union — closed, create, or edit-with-target.

```tsx
type FooDrawerMode =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; foo: Foo };

const [drawerMode, setDrawerMode] = useState<FooDrawerMode>({ kind: 'closed' });

// Imperative form sync when mode changes
useEffect(() => {
  if (drawerMode.kind === 'edit') {
    form.setValues(toFormValues(drawerMode.foo));
    form.resetDirty();
  } else if (drawerMode.kind === 'create') {
    form.reset();
  }
}, [drawerMode.kind, drawerMode.kind === 'edit' ? drawerMode.foo.id : null]);
```

The drawer edits **only the row it was opened from**. Editing a relation from inside the drawer is wrong — open the relation's own drawer instead.

## DataTable columns — declarative factory

Each feature folder has a `columns.tsx` exporting a `make<Entity>Columns()` factory that returns `ColumnDef[]`. Callbacks come in as factory parameters so the page wires them up.

```tsx
export function makeFooColumns({
  onEdit,
  onDelete,
}: {
  onEdit: (foo: Foo) => void;
  onDelete: (foo: Foo) => void;
}): ColumnDef<Foo>[] {
  return [
    { accessorKey: 'name', header: 'Name', sortable: true, filterable: true },
    { accessorKey: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    { id: 'actions', cell: (row) => <RowActions primary={{ ... }} overflow={[ ... ]} /> },
  ];
}
```

## RowActions primitive

Canonical row-actions cell: a primary action + overflow menu, tone-aware (default / danger), with `hidden` support for permission-gated items.

```tsx
<RowActions
  primary={{ label: 'Edit', onClick: () => onEdit(row) }}
  overflow={[
    { label: 'Duplicate', onClick: () => onDuplicate(row) },
    { label: 'Delete', tone: 'danger', onClick: () => onDelete(row), hidden: !canDelete },
  ]}
/>
```

## Format helpers — single source

All currency / integer / percent / date formatters live in **one** file (`src/lib/format.ts`). Never reimplement inline — prevents drift across views.

```ts
export const formatCurrency = (cents: number) => /* ... */;
export const formatCompactCurrency = (cents: number) => /* ... */;  // $1.2M
export const formatInteger = (n: number) => /* ... */;
export const formatPercent = (n: number) => /* ... */;              // expects 0..1
```

## Heading hierarchy — tier components

Three explicit tiers, not freeform `<h1>` / `<h2>`:

- **PageHeader** (Tier 1) — page title + primary actions + breadcrumbs
- **CardHeader** (Tier 2) — section title within a card
- **FormSection** (Tier 3) — form group label

Size and color contrast rules live in the components; consumers never set them.

## Semantic colors — never raw palette names

Use semantic tokens: `success` / `warning` / `danger` / `info` / `neutral`. Never raw Mantine/Tailwind names like `red` / `blue` / `green`. Default badges to `neutral`; reserve one accent for the operationally-meaningful state per surface. Disambiguate via variant (filled / light / outline), not hue.

## Query keys — strict naming

```ts
['entity', 'list', filters]    // list queries
['entity', 'detail', id]       // detail queries
```

Invalidate at the 2-segment prefix (`['entity']`) after mutations.

## React Query Provider — per-SSR-request

```tsx
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { /* ... */ } }));
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

`useState`-wrapped factory: fresh per server render, stable per browser page.

## Conditional query enabling

Always gate dependent queries:

```ts
const { data } = useQuery({
  queryKey: ['vehicle', 'list', { fleetId }],
  queryFn: () => listVehicles({ fleetId }),
  enabled: !!fleetId,
});
```

## Loading and empty states

- **Loading:** skeleton in tables, spinner in drawers. Don't block the page.
- **Empty:** explicit `EmptyState` component with primary CTA. Don't leave a blank table.
- **Error:** TanStack Query's `error` state surfaced inline, with retry button.

## Component library decision

**Mantine** — CRUD-heavy / form-table dense / internal-tool surfaces. Built-in primitives save weeks. Pair with `@mantine/form` + `schemaResolver` from `mantine-form-zod-resolver`.

**shadcn** — design flexibility / marketing-adjacent / unified Tailwind styling with a landing site. Pair with `react-hook-form` + `zodResolver`.

Same project, one choice. If the project has a marketing site and an app, default to shadcn for both. If app-only and CRUD-heavy, Mantine.

## Cross-feature import ban

Feature folders are peers, not a tree. Code in `features/cases/` cannot import from `features/products/`. If shared logic emerges, it goes in `lib/` or a primitives folder. Enforce via ESLint `no-restricted-imports` if the project is large enough.

## What NOT to do

- **Don't build local components first, "lift later."** Extend shared primitives even for single-consumer needs. Consistency over per-surface polish.
- **Don't put currency math inline.** Use `formatCurrency`. Drift across pages is a real, recurring bug.
- **Don't edit relations inside an entity's drawer.** Open the relation's own drawer.
- **Don't use raw palette names.** Always semantic tokens.
- **Don't skip empty states.** A blank table is a bug.
- **Don't reach for DataTable cell-edit when you want a drawer.** Inline editing is for fast bulk edits; the drawer is for single-row, multi-field, validated edits.

## Pitfalls referenced

- **No tests under `src/`** in our reference CRUD repo. Testing conventions have to be authored separately. See `factory-pitfalls.md`.
- **Two-way state-DB sync (RouteContext)** can desync. Avoid extracting "context with DB sync" as a generic pattern; design each use case explicitly.
- **Format helper drift** if `src/lib/format.ts` is missed. Create it on day one.

## Source patterns

Drawn from kairos (DataTable, RowActions, drawer mode unions, format helpers, heading tiers, semantic colors, query-key naming, Providers pattern, cross-feature import ban), duezy (Mantine theme + semantic colors), fleet-advisor (shadcn + Mantine variants, conditional query enabling), ford-analysis (shadcn + Context-driven selection state).
