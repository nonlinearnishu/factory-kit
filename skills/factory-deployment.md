---
name: factory-deployment
description: Deployment and infrastructure conventions across builds. Vercel + Neon for web (with PR branch DBs), Cloud Run for Python services (one service per entry-point variant), GitHub Actions matrix-deploy on merge, Terraform with environments/modules layout for AWS / compliance customers, RDS IAM authentication for AWS DBs, Docker per Python entry point, env vars via t3-oss/env-nextjs, and the single-tenant customer-cloud deployment model (per the factory thesis). Migrations in CI, never at runtime.
---

# Factory deployment

## Web — Vercel + Neon

| Aspect | Choice |
|---|---|
| Hosting | Vercel |
| Database | Neon (Postgres) — dev branches for PRs, prod for main |
| Migrations | `drizzle-kit migrate` in GitHub Actions, against ephemeral Neon branch |
| Env vars | Vercel project + `t3-oss/env-nextjs` Zod validation |
| Preview safety | Boot-time assertion: `VERCEL_ENV=preview` MUST NOT use prod `DATABASE_URL` |

```ts
// src/db/index.ts — boot-time assertion
const isPreview = process.env.VERCEL_ENV === 'preview';
if (isPreview && process.env.DATABASE_URL === process.env.PROD_DATABASE_URL) {
  throw new Error('Preview deployment cannot use prod DATABASE_URL');
}
```

## Python services — Cloud Run

One Cloud Run service **per Python entry point** (see `factory-data-pipelines.md` for the three-entry-point pattern):

| Service | Entry point | Trigger |
|---|---|---|
| `myservice-api` | `main_api.py` (FastAPI) | HTTP request |
| `myservice-pubsub` | `main_pubsub.py` (handler) | Pub/Sub topic |

Separate Dockerfiles for each. They share `src/` but the startup command differs.

```dockerfile
# Dockerfile.api
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen
COPY src/ ./src/
COPY main_api.py ./
ENV PYTHONUNBUFFERED=1
USER nonroot
CMD ["uv", "run", "uvicorn", "main_api:app", "--host", "0.0.0.0", "--port", "8080"]
```

```dockerfile
# Dockerfile.pubsub
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen
COPY src/ ./src/
COPY main_pubsub.py ./
ENV PYTHONUNBUFFERED=1
USER nonroot
CMD ["uv", "run", "python", "main_pubsub.py"]
```

Non-root user; `PYTHONUNBUFFERED=1` for log streaming.

## GitHub Actions — ephemeral DBs + matrix deploy

```yaml
# .github/workflows/ci-cd.yml (sketch)
name: ci-cd

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: neondatabase/create-branch-action@v5
        id: neon
        with:
          project_id: ${{ secrets.NEON_PROJECT_ID }}
          parent: main
          branch_name: pr-${{ github.event.pull_request.number }}
      - run: pnpm install
      - run: pnpm db:migrate
        env:
          DATABASE_URL: ${{ steps.neon.outputs.db_url }}
      - run: pnpm test

  deploy-web:
    if: github.ref == 'refs/heads/main'
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: --prod

  deploy-python:
    if: github.ref == 'refs/heads/main'
    needs: test
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [myservice-api, myservice-pubsub]
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with: { credentials_json: '${{ secrets.GCP_SA_KEY }}' }
      - run: gcloud run deploy ${{ matrix.service }} --source ./models/myservice ...
```

Ephemeral Neon branch per PR is the entire point — every PR gets a real DB without polluting prod or sharing dev. After the PR closes, delete the branch.

## Env vars — `t3-oss/env-nextjs`

```ts
// src/env.js
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    RESEND_API_KEY: z.string(),
    RESEND_BAA_SIGNED: z.enum(['true', 'false']).optional(),
  },
  client: {
    NEXT_PUBLIC_POSTHOG_KEY: z.string(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  },
  runtimeEnv: { ... },
});
```

Build fails if env vars are missing or wrong-shaped. Don't ship past the build error.

## Terraform — when AWS / compliance is in scope

Use when:
- Customer requires single-tenant deployment in their cloud (HIPAA, FDA 21 CFR 820, SOC 2 Type II)
- AWS RDS (vs Neon) for compliance posture
- Need IaC for VPCs, security groups, KMS keys, IAM roles

```
infra/terraform/
├── environments/
│   ├── production/
│   │   ├── main.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   │   └── ...
│   └── dev/
│       └── ...
└── modules/
    ├── database/           # RDS, parameter groups, backups
    ├── compute/            # ECS / Cloud Run / Fargate
    ├── networking/         # VPC, subnets, security groups
    └── secrets/            # KMS, Secrets Manager
```

`environments/<env>/main.tf` consumes modules; `terraform.tfvars` supplies the per-env values. Don't put hardcoded prod values in `main.tf`.

## RDS IAM authentication

For AWS RDS (Postgres / MySQL), use IAM authentication — no long-lived passwords:

```ts
// src/db/rds-auth.ts
import { Signer } from '@aws-sdk/rds-signer';

const signer = new Signer({
  hostname: process.env.RDS_HOSTNAME!,
  port: 5432,
  username: process.env.RDS_USERNAME!,
  region: process.env.AWS_REGION!,
});

async function getToken(): Promise<string> {
  return signer.getAuthToken();
}
```

Token rotates every 14 minutes; cache and refresh near expiry. Pair with lazy DB singleton (`Proxy`-wrapped) so connections only open after IAM token is fetched.

## Migrations — CI, never runtime

```sh
# Local dev — schema push (fast iteration)
drizzle-kit push

# Pre-merge — generate migration file from schema diff
drizzle-kit generate

# CI — apply migrations against ephemeral PR DB
drizzle-kit migrate

# CI / merge to main — apply migrations against prod DB before deploying app
drizzle-kit migrate
```

**Never put `drizzle-kit migrate` in a Cloud Run `CMD` or Vercel build step.** Migrations are CI's job, not runtime's.

## Single-tenant customer-cloud deployment (the factory thesis)

For compliance-sensitive customers (medical device, healthcare, regulated finance):

| Aspect | Choice |
|---|---|
| Deployment | Single-tenant container in customer's GCP or AWS account |
| Bootstrap | One-command Terraform module — "deploys in 2 hours" |
| Data residency | Customer's region — never crosses into the factory's infra |
| Secrets | Customer's AWS Secrets Manager / GCP Secret Manager — never in the factory repo |
| Updates | Customer pulls a new pinned tag of the factory-kit repo |

This is the differentiator vs. SaaS competitors (Retool, Superblocks). Customer data never leaves their cloud. The factory is the substrate, not the host.

## What NOT to do

- **Don't run migrations at runtime.** CI's job.
- **Don't share Cloud Run services across entry points.** Separate service per entry-point variant.
- **Don't hardcode prod values in Terraform `main.tf`.** Use `terraform.tfvars` per environment.
- **Don't use long-lived passwords for AWS RDS.** IAM authentication.
- **Don't skip the preview-DB boot-time assertion.** Configuration mistakes should fail loud at boot.
- **Don't store customer secrets in the factory-kit repo.** Customer's cloud, customer's secrets manager.
- **Don't ship Docker images as root.** Always non-root user.
- **Don't deploy unbuffered Python without `PYTHONUNBUFFERED=1`.** Logs won't stream.

## Pitfalls referenced

- **Migrations at Cloud Run startup** → 30-second cold start, brittle if migration fails mid-startup. CI is the right place.
- **No preview-DB safety check** → preview deployment silently writes to prod.

## Source patterns

Encode/monorepo (Cloud Run with separate Dockerfile.api / Dockerfile.pubsub, GitHub Actions ephemeral Neon branches, matrix-deploy on merge, PostHog ingest rewrite), duezy (Terraform environments/modules layout, RDS IAM authentication with 14-min refresh, lazy DB singleton via Proxy), fleet-advisor (Vercel + Neon, t3-oss/env-nextjs Zod validation, monorepo deploy strategy), ford-analysis (`VERCEL_ENV` preview-DB safety check), Obsidian software-factory-idea (single-tenant customer-cloud deployment as commercial differentiator).
