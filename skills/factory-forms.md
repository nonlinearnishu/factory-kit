---
name: factory-forms
description: Form conventions distilled across builds. react-hook-form + Zod via resolver (Mantine or shadcn variant), three Zod schema variants (server strict / client lenient / patch), drawer-CRUD with mode union, field-registry pattern for multi-step forms, declarative conditional visibility with auto-cleanup, debounced auto-save with dirty tracking, masked inputs for sensitive fields with KMS encryption-at-rest, dynamic field arrays with constraints, S3 presigned-URL upload flow. Read when scaffolding any form — single-step CRUD or multi-step complex intake.
---

# Factory forms

## Stack

- **react-hook-form** — form state, validation, submission
- **Zod** — schemas
- **Resolver** — `mantine-form-zod-resolver` (Mantine) or `@hookform/resolvers/zod` (shadcn)
- **Server submission** — server action or tRPC mutation (see `factory-api.md`)

## Three Zod schema variants per entity

```ts
// features/customers/schema.ts

// Server input — strict types, server enforces these
export const customerInputSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[0-9-]+$/),
  industry: z.enum(['retail', 'wholesale', 'manufacturing']),
});

// Client form — lenient, accepts empty strings (controlled-input compat)
export const customerFormSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(1, 'Required'),
  email: z.string().email().or(z.literal('')).optional(),
  phone: z.string().or(z.literal('')).optional(),
  industry: z.enum(['retail', 'wholesale', 'manufacturing']).or(z.literal('')).optional(),
});

// Patch — partial updates
export const customerPatchSchema = customerInputSchema.partial();
```

The client form schema accepts empty strings because controlled inputs initialize to `''`. The server schema enforces real shape. The two are deliberately different — don't try to unify.

## Drawer-CRUD mode union — single-entity forms

For "list of entities, click to edit" surfaces, the form lives in a drawer:

```tsx
type CustomerDrawerMode =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; customer: Customer };

const [mode, setMode] = useState<CustomerDrawerMode>({ kind: 'closed' });
const form = useForm({ resolver: zodResolver(customerFormSchema) });

// Imperative form sync when mode changes
useEffect(() => {
  if (mode.kind === 'edit') {
    form.reset(toFormValues(mode.customer));
  } else if (mode.kind === 'create') {
    form.reset(emptyCustomerFormValues);
  }
}, [mode.kind, mode.kind === 'edit' ? mode.customer.id : null]);
```

Drawer edits **only the row it was opened from**. Relations open their own drawers.

## Field registry — multi-step / AI-context-aware forms

For long, multi-step intake forms (banking applications, onboarding wizards), the per-field approach gets unwieldy. Use a field registry:

```ts
// src/lib/fields/registry.ts
export const FIELDS = {
  company_name: {
    label: 'Company name',
    type: 'text',
    required: true,
    validation: z.string().min(1),
    aiContext: 'Legal entity name as registered',
  },
  ein: {
    label: 'EIN',
    type: 'masked',
    mask: '99-9999999',
    validation: z.string().regex(/^\d{2}-\d{7}$/),
    sensitive: true,
  },
  // ... 70+ fields
} as const satisfies Record<string, FieldDef>;
```

Each field is a single source of truth for: label, type, validation, AI context (if relevant), section, conditional visibility rules.

The form renderer reads metadata, not hardcoded JSX per field. See `factory-llm-workflows.md` for the AI-context angle.

## Modular section files — from day one

For multi-step forms, split sections into separate files immediately. Never write a monolith first "and refactor later":

```
src/components/forms/sections/
├── Section1_CompanyInformation.tsx
├── Section2_Regulatory.tsx
├── Section3_Banking.tsx
└── ...
```

Each file 500-1500 lines is fine. Monolithic 1,500-line single-file forms are a refactor liability.

## Conditional visibility + auto-cleanup

Declarative rules for showing/hiding fields based on other field values:

```ts
// src/lib/utils/conditional-visibility.ts
export type VisibilityRule = {
  field: string;
  showWhen: (values: FormValues) => boolean;
};

export const VISIBILITY_RULES: VisibilityRule[] = [
  { field: 'beneficial_owner_2', showWhen: (v) => v.has_multiple_owners === 'yes' },
  // ...
];
```

When a parent field changes and the child is no longer visible, **auto-clear the child's value**. Otherwise stale conditional data sneaks into submissions:

```ts
export function useAutoCleanup(form: UseFormReturn, rules: VisibilityRule[]) {
  useEffect(() => {
    return form.watch((values) => {
      for (const rule of rules) {
        if (!rule.showWhen(values) && values[rule.field] != null) {
          form.setValue(rule.field, undefined);
        }
      }
    }).unsubscribe;
  }, [form, rules]);
}
```

## Debounced auto-save with dirty tracking

For long forms where users get interrupted, auto-save on blur:

```ts
const DEBOUNCE_MS = 2000;
const SAFETY_INTERVAL_MS = 3 * 60 * 1000;

useEffect(() => {
  const sub = form.watch(() => {
    debouncedSave(form.getValues());
  });
  return () => sub.unsubscribe();
}, [form]);

// Safety net — flush every 3 minutes even if user doesn't blur
useInterval(() => flushSave(form.getValues()), SAFETY_INTERVAL_MS);
```

Server side, accept the lenient schema (auto-save can save invalid data). Validate only on submission.

## Masked inputs for sensitive fields

EIN, SSN, phone, wallet addresses — use masked inputs with explicit format:

```tsx
<MaskedInput
  mask="999-99-9999"
  placeholder="123-45-6789"
  {...form.register('ssn')}
/>
```

For SSN / government ID / financial accounts: encrypt at rest with KMS (see `factory-security.md`). Mask in display, decrypt only at the specific handler that needs plaintext.

## Dynamic field arrays

Contacts, beneficial owners, registered agents — variable-count entries:

```tsx
const { fields, append, remove } = useFieldArray({
  control: form.control,
  name: 'contacts',
  rules: { maxLength: { value: 10, message: 'Max 10 contacts' } },
});
```

Max-count constraint enforces business rules at the form layer (sometimes server too).

## S3 presigned-URL document upload

Three-step flow for document attachments:

```ts
// 1. Generate URL (server action)
const { uploadUrl, fileKey } = await generateUploadUrl({ contentType, filename });

// 2. Upload directly to S3 (client)
await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': contentType } });

// 3. Confirm upload (server action — records the fileKey)
await confirmUpload({ formId, fieldId, fileKey });
```

Don't proxy uploads through your server — direct-to-S3 is bandwidth-cheap and removes the file-size limit problem.

## `useTransition` for async submission

```tsx
const [isPending, startTransition] = useTransition();

const onSubmit = (values: FormValues) => {
  startTransition(async () => {
    const result = await createCustomer(values);
    if (result.error) { toast.error(result.error); return; }
    setMode({ kind: 'closed' });
    queryClient.invalidateQueries({ queryKey: ['customers'] });
  });
};
```

`isPending` gates the submit button. No double-submission risk.

## Question numbering via context

For review/summary views where field labels need "Question 12" prefixes:

```tsx
const QuestionNumberingContext = createContext<{ next: () => number }>(null);

export function QuestionLabel({ children }: { children: ReactNode }) {
  const { next } = useContext(QuestionNumberingContext);
  const num = useMemo(next, [next]);
  return <Label>{num}. {children}</Label>;
}
```

Numbers update consistently when sections reorder.

## Review section with gap detection

For complex forms, show a "review your answers" section that lists only **visible** fields (respecting conditional visibility) and highlights incomplete ones:

```tsx
export function ReviewSection({ values, registry, visibilityRules }: ReviewProps) {
  const visibleFields = computeVisibleFields(registry, visibilityRules, values);
  const gaps = visibleFields.filter((f) => isEmpty(values[f.id]));
  return (
    <>
      {gaps.length > 0 && <Alert>You have {gaps.length} incomplete answers</Alert>}
      {visibleFields.map((f) => <ReviewRow key={f.id} field={f} value={values[f.id]} />)}
    </>
  );
}
```

## What NOT to do

- **Don't write a monolithic 1,500-line form.** Modular section files from day one.
- **Don't unify server and client schemas.** Server is strict; client is lenient with empty-string fallbacks.
- **Don't leave stale conditional data in submissions.** Auto-cleanup on visibility change.
- **Don't proxy file uploads through your server.** Direct-to-S3 with presigned URLs.
- **Don't submit auto-save data on submit.** Re-validate against the strict schema before submission.
- **Don't store SSN / government ID / PHI in plaintext.** KMS at rest, mask in display.
- **Don't await audit logs on the submission critical path.** Fire-and-forget.

## Pitfalls referenced

- **Monolithic 1,592-line form** (duezy original). Painful refactor; modular from day one.
- **Three competing progress calculators** (duezy). Delete inputs in the same PR as the unifier.
- **CLAUDE.md describing aspirational architecture** (duezy). Update docs with refactors.

## Source patterns

Duezy (field registry, modular section files, lenient/strict Zod variants, conditional visibility + auto-cleanup, debounced auto-save with dirty tracking, masked inputs, dynamic field arrays, S3 presigned uploads, question numbering context, review section with gap detection, unified progress calculator), kairos (drawer mode union, `useTransition` submission, Mantine + schemaResolver pattern, per-context Zod variants), fleet-advisor (shadcn + react-hook-form pattern).
