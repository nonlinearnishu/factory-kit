# Factory house rules (user-level)

This file is symlinked into `~/.claude/CLAUDE.md` and loaded into every project on this machine. It points at the synthesized cross-build conventions and specialist subagents in `~/.claude/skills/` and `~/.claude/agents/`. Source of truth: `~/Documents/nonlinear/factory-kit/`.

## When starting any non-trivial feature

Invoke `feature-architect` first. It scopes the request, identifies decisions-needed, and routes to the right specialist subagents.

## Skills (auto-loaded — `factory-*` namespace)

- **factory-stack** — locked stack + decision criteria (read at project kickoff)
- **factory-frontend** — DataTable + drawer-CRUD, RowActions, format helpers, semantic colors
- **factory-auth** — provider pick, unified `requireAuth`/`requireRole`/`withOrgContext` wrapper
- **factory-data-layer** — Drizzle schema partitioning, multi-tenancy, JSONB envelope, polymorphic tables
- **factory-forms** — react-hook-form + Zod variants, drawer-CRUD, field registry, conditional visibility
- **factory-api** — server actions vs tRPC, pagination, error class taxonomy
- **factory-data-pipelines** — CSV ingestion (Papa Parse), JSONB envelope, three-entry-point Python pattern
- **factory-llm-workflows** — LangGraph TypedDict state, node factories, RAG with confidence gating, SSE streaming
- **factory-security** — KMS-at-rest, BAA, safe redirects, admin-client guardrails, AI-code risk
- **factory-observability** — PostHog + Sentry day 1, trace IDs, structured logs, audit logging
- **factory-deployment** — Vercel + Neon + Cloud Run + Terraform (single-tenant for compliance)
- **factory-pitfalls** — anti-pattern digest indexed across all skills; use as PR checklist

## Specialist subagents (callable via Agent tool)

- **feature-architect** — turns vague client asks into buildable specs; routes to other agents
- **frontend-engineer** — UI surfaces, CRUD scaffolding, drawer-CRUD
- **db-schema-architect** — schema design, migrations, multi-tenancy keys
- **auth-wiring-specialist** — auth provider setup, RBAC, org context
- **forms-builder** — multi-step forms, field registry, conditional visibility
- **api-route-engineer** — endpoints, validation, pagination, error shape
- **data-pipeline-engineer** — CSV ingestion, Python services, time-series storage
- **llm-workflow-engineer** — LangGraph workflows, RAG, structured output, streaming
- **security-engineer** — threat modeling, AI-code review, sensitive-data handling
- **code-reviewer** — PR review against factory-pitfalls digest

## Slash commands (auto-loaded into `~/.claude/commands/`)

Linear ticket workflow — universal, project-agnostic. Each project that wants these needs `.claude/linear.json` (run `/setup-linear` once to create it).

- **/setup-linear** — bootstrap `.claude/linear.json` (team, optional project, state names)
- **/standup** — dev standup view: in-progress / in-review / top priority / backlog
- **/entry `<issue>`** — load a Linear issue into context and enter plan mode
- **/submit `[issue]`** — move ticket to "In Review" (auto-detects from branch if no arg)
- **/close `[issue]`** — closing comment + move to Done + delete local branch / exit worktree

Branch convention assumed by `/submit` and `/close`: any branch containing `<teamkey>-<num>` (case-insensitive) — e.g., `nishu/non-45-topic` → `NON-45`.

## Per-project decisions

Each new project should have a `DECISIONS.md` (or short section in its `CLAUDE.md`) declaring its picks from `factory-stack.md`'s decision-criteria choices: component library (Mantine vs shadcn), API style (server actions vs tRPC), auth provider, ORM, deployment target. Default to the kit's primary recommendation if not stated.

## What the kit does NOT decide

- Project name, domain language, business rules — those belong in the project
- Customer-specific secrets / config — never live in the kit's repo
- Roles and permissions specific to a domain — defined per project

Code that's about *how we build* lives here. Code that's about *what we're building* lives in the project.
