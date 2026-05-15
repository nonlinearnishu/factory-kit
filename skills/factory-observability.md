---
name: factory-observability
description: Observability conventions across builds. PostHog + Sentry on day one (non-negotiable per the factory thesis — easiest to start early, most expensive to backfill). Request tracing with propagated trace IDs, structured logging, activity-log audit table, event tagging by tool/feature for per-tool usage queryability, PostHog ingest-URL rewrite to avoid ad-blocker breakage. What to log, what NOT to log (PII).
---

# Factory observability

## Day-one stack — non-negotiable

| Layer | Tool | Purpose |
|---|---|---|
| Product analytics | **PostHog** | Per-feature usage, funnels, session replay |
| Error tracking | **Sentry** | Exceptions, performance, source maps |
| Audit log | DB table (`admin_actions` or `audit_log`) | Mutation provenance, regulatory compliance |
| Request tracing | Trace ID middleware + logs | Cross-service debugging |
| Structured logs | `pino` (Node) / `structlog` (Python) | Searchable, machine-parseable |

Adding these later is several weeks of work each. Add them on day one even when the project feels too small to need them.

## PostHog — client setup

```tsx
// src/components/PostHogProvider.tsx
'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { useEffect } from 'react';

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: '/ingest',                  // proxied — see rewrites below
    capture_pageview: false,              // we call manually with route context
    person_profiles: 'identified_only',
  });
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
```

```js
// next.config.js — rewrite ingest URL to bypass ad-blockers
async rewrites() {
  return [
    { source: '/ingest/static/:path*', destination: 'https://us-assets.i.posthog.com/static/:path*' },
    { source: '/ingest/:path*',         destination: 'https://us.i.posthog.com/:path*' },
  ];
}
```

Without the rewrite, browser-level ad-blockers drop ~30% of events. Worth the 10-minute setup.

## Event tagging — tool/feature attribution

Tag every event with the surface that emitted it:

```ts
posthog.capture('customer_created', {
  feature: 'customers',          // which feature folder
  surface: 'customers_drawer',   // which surface
  org_id: orgId,
  source: 'manual',              // vs 'import' vs 'api'
});
```

Later, "how often is X used per org?" becomes a query, not a manual count. This is the long-term play — usage data compounds.

## Sentry — Next.js + Python

```ts
// sentry.client.config.ts / sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,                  // 10% perf sampling
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 1.0,          // capture session on error
  environment: process.env.VERCEL_ENV ?? 'development',
});
```

```py
# Python — Sentry SDK
import sentry_sdk
sentry_sdk.init(
    dsn=os.environ['SENTRY_DSN'],
    traces_sample_rate=0.1,
    environment=os.environ.get('ENV', 'development'),
)
```

User context attached after auth, so exceptions are scoped to the user that triggered them.

## Trace ID middleware

Every request gets a `x-request-id`. If incoming, propagate. If not, generate:

```py
# Python / FastAPI
@app.middleware("http")
async def trace_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response
```

```ts
// Next.js middleware
export function middleware(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const res = NextResponse.next();
  res.headers.set('x-request-id', requestId);
  return res;
}
```

Log the request ID with every structured log line. When a customer reports a bug, the trace ID is what unblocks the support conversation.

## Structured logging

```ts
// Node — pino
import pino from 'pino';
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: { level: (label) => ({ level: label }) },
  base: { service: 'web', env: process.env.VERCEL_ENV },
});

logger.info({ user_id, request_id, action: 'customer.create' }, 'created customer');
```

```py
# Python — structlog
import structlog
log = structlog.get_logger().bind(service='fleetsim')

log.info('simulation_started', request_id=request_id, fleet_id=fleet_id)
```

**Never `console.log` raw strings.** Structured logs are searchable; string-concat is grep-only.

## Activity log — DB-backed audit trail

```ts
// fire-and-forget — never blocks mutations
export async function logAdminAction(input: {
  actor_id: string;
  action: string;
  subject_type?: string;
  subject_id?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(adminActions).values(input);
  } catch (err) {
    logger.error({ err, input }, 'audit_log_write_failed');
  }
}
```

Schema in `factory-data-layer.md`. Use for regulatory compliance, support investigations, customer-facing "who changed this?" displays.

## What to log

- **Actions and IDs**: `{ user_id: 'u_xyz', action: 'updated_ssn', subject_id: 'c_abc' }`
- **Request context**: trace ID, user agent (high-level), feature/surface tag
- **Counts and durations**: `{ duration_ms: 142, rows_affected: 3 }`
- **External system call results**: status code, request ID echoed back (Stripe, Twilio, etc.)

## What NOT to log

- **Raw PII / PHI payloads**: full SSN, government IDs, financial account numbers
- **Auth tokens / API keys**: at any layer, ever
- **Full request bodies**: redact at the logger layer if you need to debug
- **Decrypted ciphertext**: see `factory-security.md`

PII in logs creates compliance scope creep — logs end up needing the same protection as the source database.

## Per-tool usage queryability — the long play

Per Obsidian software-factories note: tag events by tool/feature so per-tool usage is queryable later. This is the layer-10 (observability) commitment that pays off when you have a year of data and want to know "which features are dead?"

Concretely: every PostHog event has a `feature` property and a `surface` property. Don't skip this even on a one-off project.

```ts
posthog.capture(eventName, {
  feature,        // which factory feature this is part of
  surface,        // which screen / drawer / table
  // ... domain props
});
```

Six months later: `SELECT feature, count(*) FROM events GROUP BY feature ORDER BY 2 DESC` is the answer to "which features earn their maintenance cost?"

## What NOT to do

- **Don't ship without PostHog + Sentry.** Even prototypes. Adding later is weeks of work.
- **Don't skip the PostHog ingest rewrite.** Ad-blockers drop ~30% of events otherwise.
- **Don't `console.log` strings.** Structured logs only.
- **Don't await audit log writes on the mutation critical path.** Fire-and-forget.
- **Don't log raw PII or full payloads.** Compliance scope creep.
- **Don't skip the feature/surface tags on events.** Without them, "which features are used?" is unanswerable later.
- **Don't generate new trace IDs when one was sent in.** Propagate.

## Pitfalls referenced

- **No trace IDs across services** → cross-service debugging requires manual log alignment. Middleware on day one.
- **PII in logs** → compliance scope expands to include log storage. Redact at logger layer.

## Source patterns

Encode/monorepo (PostHog setup, ingest URL rewrite, PHProvider component), cothon (request logging middleware with trace ID propagation, x-request-id response header), kairos (`adminActions` table, fire-and-forget `logAdminAction`), fleet-advisor (activity logging at router-layer with action/object metadata), Obsidian software-factory-idea (PostHog + Sentry day-one commitment, per-tool usage queryability as layer-10 thesis).
