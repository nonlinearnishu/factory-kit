# factory-kit

Personal "factory settings" — synthesized cross-build wisdom and specialist subagents that load into every Claude Code project.

This is the Phase 0 prototype of [Nonlinear Labs](https://github.com/) software factory. The skills and agents here are extracted from six prior builds (kairos, duezy, cothon, fleet-advisor, ford-analysis, encode/monorepo) and codified as cross-build *conventions* — not per-repo notes.

## Layout

```
factory-kit/
├── skills/                # synthesized factory-*.md docs, auto-loaded as ~/.claude/skills/
├── agents/                # specialist subagents, callable via the Agent tool
├── commands/              # slash commands (Phase C)
└── install.sh             # symlinks skills/, agents/, commands/ into ~/.claude/
```

## Install

```sh
./install.sh
```

This creates per-file symlinks from this repo into `~/.claude/skills/`, `~/.claude/agents/`, and `~/.claude/commands/`. Existing files at the destination are not overwritten — the script warns and skips. Re-run after pulling updates.

## What's in here

### Skills (`factory-*.md`)

The "house rules" — synthesized cross-build conventions with explicit decision criteria where the kit doesn't lock a single answer.

| Skill | Domain | Status |
|---|---|---|
| `factory-stack.md` | Locked + flexible stack decisions, decision criteria | Phase A |
| `factory-frontend.md` | DataTable + drawer-CRUD, RowActions, formatters, Mantine vs shadcn | Phase A |
| `factory-data-pipelines.md` | CSV imports, time-series envelopes, Python service entry points | Phase A |
| `factory-llm-workflows.md` | LangGraph TypedDict state, node factories, RAG, SSE streaming | Phase A |
| `factory-security.md` | KMS-at-rest, BAA/PHI, safe redirects, AI-code risk | Phase A |
| `factory-pitfalls.md` | Anti-patterns digest indexed across all domains | Phase A |
| `factory-auth.md` | Better Auth + orgs primary, RLS/Clerk criteria, wrapper interface | Phase B |
| `factory-data-layer.md` | Drizzle schema partitioning, multi-tenancy keys, timestamps helper | Phase B |
| `factory-forms.md` | react-hook-form + Zod variants, field registry, masked inputs | Phase B |
| `factory-api.md` | Server actions vs tRPC criteria; validation; error shape | Phase B |
| `factory-observability.md` | PostHog + Sentry day 1, activity logging, trace IDs | Phase B |
| `factory-deployment.md` | Vercel + Cloud Run + Terraform conventions | Phase B |

### Agents (specialist subagents)

Each is a Claude Code subagent file (YAML frontmatter + markdown body) modeled on the kairos `frontend-design` agent. Curated tool list, single model choice.

| Agent | When to invoke | Status |
|---|---|---|
| `frontend-engineer` | UI scaffolding, CRUD surfaces, component-library decisions | Phase A |
| `data-pipeline-engineer` | CSV ingestion, Python services, simulation envelopes | Phase A |
| `llm-workflow-engineer` | LangGraph workflows, RAG, structured output, streaming | Phase A |
| `security-engineer` | Threat-model a feature, audit AI-generated code, sensitive-data handling | Phase A |
| `feature-architect` | Scope a vague client ask into a buildable feature spec | Phase A |
| `db-schema-architect` | Drizzle schemas, migrations, multi-tenancy | Phase B |
| `auth-wiring-specialist` | Better Auth + orgs setup, RBAC, session handling | Phase B |
| `forms-builder` | Multi-step forms, field registry, conditional visibility | Phase B |
| `api-route-engineer` | Routes, validation, error responses, pagination | Phase B |
| `code-reviewer` | Style enforcement + pitfalls digest as review checklist | Phase B |

## Versioning

This repo is git-tracked. When productizing as a customer-deployed harness, customers clone a pinned tag.

## Provenance

Patterns extracted via the Pass 1 / Pass 2 / Pass 3 skills-inventory exercise (May 2026). Raw per-repo pattern lists are conversation-bound; this kit is the synthesized output.
