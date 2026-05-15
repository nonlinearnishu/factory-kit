---
name: factory-data-pipelines
description: Data ingestion and pipeline conventions for projects that import CSVs, run simulations, or operate Python services alongside Next.js. Covers Papa Parse for CSV imports, JSONB envelope storage for time-series data, the three-entry-point Python service pattern (CLI / Cloud Run API / Pub/Sub handler), YAML config for service-level data, geopandas/shapely for geospatial work, and deployment via Cloud Run + ephemeral Neon DBs.
---

# Factory data pipelines

## CSV ingestion — TypeScript scripts with Papa Parse

Default shape for one-shot or scheduled CSV imports:

```
scripts/
└── data_processing/
    ├── import-state-data.ts
    ├── simulations/
    │   └── import-simulation.ts
    └── vins/
        └── import-vins.ts
```

Each script is standalone — uses `papaparse`, opens a Drizzle connection, runs in a transaction, exits. Don't wrap in a job framework until there's a second consumer.

```ts
import Papa from 'papaparse';
import { db } from '@/db';
import { foo } from '@/db/schema';

const { data } = Papa.parse<FooRow>(csvText, { header: true, skipEmptyLines: true });

await db.transaction(async (tx) => {
  for (const row of data) {
    await tx.insert(foo).values({ /* ... */ }).onConflictDoUpdate({ /* ... */ });
  }
});
```

## Time-series / event storage — JSONB envelope

For simulation data, event streams, or anything time-series-shaped where the inner schema may evolve:

```ts
export const simulations = pgTable('simulations', {
  id: uuid('id').defaultRandom().primaryKey(),
  ...timestamps,
  // Structured columns for things that drive queries
  fleetId: uuid('fleet_id').references(() => fleets.id, { onDelete: 'cascade' }).notNull(),
  status: text('status').notNull(),
  // JSONB envelope for everything else
  metadata: jsonb('metadata').$type<SimulationMetadata>().notNull(),
  timeSeriesData: jsonb('time_series_data').$type<TimeSeriesPoint[]>().notNull(),
  chargingEvents: jsonb('charging_events').$type<ChargingEvent[]>().notNull(),
});
```

**Rule:** what drives queries (filters, sorts, joins) gets a real column. The rest goes in JSONB. Don't query inside JSONB at app speed — if you need to, the field has earned a column.

## YAML-driven service config (Python side)

For Python services that read static / slowly-changing reference data:

```
models/<service>/
├── config/
│   ├── routes.yaml
│   ├── vehicles.yaml
│   └── chargers.yaml
└── src/
    └── services/
        └── data_service.py    # loads + validates + serves the config
```

JSON config overrides via env var or request payload. Don't put this data in code — it's the seam your customer (or your future self) edits.

## Three-entry-point pattern (Python services)

Every Python service has three entry points sharing core logic:

```
models/<service>/
├── main.py              # CLI — local runs, ad-hoc invocations
├── main_api.py          # FastAPI — Cloud Run HTTP endpoint
├── main_pubsub.py       # Pub/Sub handler — async job processing
├── Dockerfile           # Pub/Sub variant
├── Dockerfile.api       # API variant
└── src/
    ├── simulation/
    │   └── simulation_runner.py   # the actual work; mode-aware
    └── services/                  # injected deps (Mapbox, weather, GCS, DB)
```

`simulation_runner.py` is mode-aware (CLI vs Cloud) — structured log paths, GCS + DB integration. The three entry points are thin wrappers.

## FastAPI conventions

- API-key dependency: `get_api_key()` reads from header, validates against env
- OpenAPI docs toggleable via env (off in prod)
- Pydantic models for all request/response shapes — never inline dicts
- Lifespan context manager for DB engine init/close
- Request logging middleware with trace ID propagated to response header

```py
@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response
```

## Cloud Pub/Sub triggering from Next.js

```ts
// src/server/cloud/cloudRun.ts
export async function triggerSimulationJob(payload: SimulationRequest) {
  const message = { ...payload, mode: 'db' /* or 'gcs' */ };
  return pubsub.topic(TOPIC).publishMessage({ json: message });
}
```

GCP credentials from env (JSON string or file path — use the env-driven helper, not hardcoded paths).

## Submit / poll / fetch async pattern

For batch jobs where the runtime exceeds HTTP timeout: submit returns a job ID, client polls a status endpoint, fetches results separately.

```ts
const { jobId } = await fleetsim.submit(payload);
const status = await fleetsim.pollStatus(jobId);  // until 'complete' | 'failed'
const result = await fleetsim.fetchResult(jobId);
```

Three endpoints, three idempotent operations. Never block the client on a single long-running HTTP call.

## Converter vs service split

For external-API or compute-heavy code:

- **Converter** (`*-converter.ts`) — pure transformation functions. Client-safe. No I/O.
- **Service** (`*-service.ts`) — orchestrates I/O. Server-only. May call multiple converters.

Don't blur the boundary — converter is the part you reuse in the client; service is the part that talks to the world.

## Geospatial — geopandas + shapely

Route loading from GeoJSON, coordinate extraction from `LineString` / `MultiLineString` / `Polygon` belongs in a single `data_service.py`. Don't duplicate per consumer.

## Deployment

- **Web (Next.js):** Vercel
- **Python services:** Cloud Run, one service per Python entry-point variant (separate Dockerfiles, different startup commands)
- **DBs:** Neon for web (branch-per-PR via GitHub Actions); shared instance for backend services
- **GitHub Actions:** ephemeral Neon DB per PR; matrix-deploy web + each Python service to Cloud Run on merge

Migrations run in CI, not at runtime.

## What NOT to do

- **Don't pre-build `libs/py-libs/` shared utilities.** Empty scaffolding is worse than no scaffolding. Wait for the second consumer.
- **Don't query inside JSONB at app speed.** If a field drives a query, promote it to a column.
- **Don't write CSV import logic as a Cloud Run job before the second use case.** A standalone TS script in `scripts/` is enough until proven otherwise.
- **Don't hardcode YAML paths.** Use env-driven base paths so config is overridable per environment.
- **Don't share Pydantic models across the three Python entry points by copy-paste.** Define once in `models/`, import everywhere.
- **Don't run migrations inside Cloud Run startup.** Migrations are CI's job.
- **Don't blur converter / service boundaries.** Pure-transform code stays in `*-converter.ts`; I/O lives in `*-service.ts`.

## Pitfalls referenced

- **Raw SQL with hand-mapped row→object functions** (encode/monorepo) is verbose, error-prone, no type inference. Use Drizzle web-side; SQLAlchemy with the SoftDelete mixin Python-side.
- **Mixed migration-file naming** (timestamped + descriptive in the same dir) makes schema evolution hard to read. Pick one and stick.

## Source patterns

Ford-analysis (CSV imports via Papa Parse, JSONB envelope, modular calculator engine, submit-poll-fetch async pattern, converter/service split), encode/monorepo (three-entry-point Python pattern, YAML config, FastAPI shape, Pub/Sub triggering, geopandas/shapely), cothon (request logging middleware, async SQLAlchemy with SoftDelete mixin).
