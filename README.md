# factory-kit

> **Status:** v0.1.0 — Phase 0, actively iterating. Expect renames and breaking changes inside `0.x`. [Releases](https://github.com/nonlinearnishu/factory-kit/releases) are the changelog.

A personal Claude Code "factory" — synthesized cross-build conventions, specialist subagents, and slash commands, installed as symlinks into `~/.claude/`.

## Why this exists

After ~six client builds I noticed the same arguments repeating: server actions vs tRPC, Mantine vs shadcn, Better Auth vs Clerk vs Supabase, where the JSONB envelope lives, how to scope a vague client ask. Each project re-decided things I'd already decided. This kit is the synthesized output of those decisions — *how we build*, separated from *what we're building* — wired into Claude Code so every project starts with the same priors.

It's also a public record of how I'm iterating on a "software factory." Phase 0 = synthesized skills + agents + a Linear workflow. Phase 1+ = whatever the next month surfaces.

## Layout

```
factory-kit/
├── skills/                # synthesized factory-*.md docs, auto-loaded as ~/.claude/skills/
├── agents/                # specialist subagents, callable via the Agent tool
├── commands/              # slash commands (/standup, /entry, /submit, /close, /setup-linear)
├── CLAUDE.md              # user-level header listing the rosters above
├── commitlint.config.cjs  # kit's own commitlint (Conventional Commits, no Linear-ID rule)
├── VERSION
└── install.sh             # per-file symlinks into ~/.claude/{skills,agents,commands}
```

## Install

```sh
# pin to a release (recommended)
git checkout v0.1.0
./install.sh

# or track HEAD (moving edge)
git checkout main
./install.sh
```

`install.sh` is idempotent — re-run after pulling. Existing files at destinations are skipped with a warning; symlinks pointing into this repo are refreshed.

## What's in here

### Skills (`factory-*.md`)

Synthesized cross-build conventions. Auto-loaded by Claude Code from `~/.claude/skills/`.

| Skill | Domain |
|---|---|
| `factory-stack` | Locked + flexible stack decisions, decision criteria |
| `factory-frontend` | DataTable + drawer-CRUD, RowActions, formatters, Mantine vs shadcn |
| `factory-auth` | Better Auth + orgs primary, RLS/Clerk criteria, wrapper interface |
| `factory-data-layer` | Drizzle schema partitioning, multi-tenancy keys, timestamps helper |
| `factory-forms` | react-hook-form + Zod variants, field registry, masked inputs |
| `factory-api` | Server actions vs tRPC criteria; validation; error shape |
| `factory-data-pipelines` | CSV imports, time-series envelopes, Python service entry points |
| `factory-llm-workflows` | LangGraph TypedDict state, node factories, RAG, SSE streaming |
| `factory-security` | KMS-at-rest, BAA/PHI, safe redirects, AI-code risk |
| `factory-observability` | PostHog + Sentry day 1, activity logging, trace IDs |
| `factory-deployment` | Vercel + Cloud Run + Terraform conventions |
| `factory-commits` | Conventional Commits + required Linear-ID; commitlint config |
| `factory-pitfalls` | Anti-patterns digest indexed across all domains; usable as PR checklist |

### Agents (specialist subagents)

Each is a Claude Code subagent file (YAML frontmatter + markdown body). Callable via the Agent tool.

| Agent | When to invoke |
|---|---|
| `feature-architect` | Scope a vague client ask into a buildable feature spec; routes to the right specialists |
| `frontend-engineer` | UI scaffolding, CRUD surfaces, component-library decisions |
| `db-schema-architect` | Drizzle schemas, migrations, multi-tenancy keys |
| `auth-wiring-specialist` | Auth provider setup, RBAC, org context |
| `forms-builder` | Multi-step forms, field registry, conditional visibility |
| `api-route-engineer` | Endpoints, validation, error responses, pagination |
| `data-pipeline-engineer` | CSV ingestion, Python services, simulation envelopes |
| `llm-workflow-engineer` | LangGraph workflows, RAG, structured output, streaming |
| `security-engineer` | Threat-model a feature, audit AI-generated code, sensitive-data handling |
| `code-reviewer` | PR review against `factory-pitfalls.md` checklist |

### Slash commands

Linear ticket workflow — project-agnostic. Each project that wants these runs `/setup-linear` once to create `.claude/linear.json`.

- `/setup-linear` — bootstrap `.claude/linear.json` (team, optional project, state names)
- `/standup` — in-progress / in-review / top priority / backlog view
- `/entry <issue>` — load a Linear issue into context and enter plan mode
- `/submit [issue]` — move ticket to "In Review" (auto-detects from branch)
- `/close [issue]` — closing comment + Done + delete local branch / exit worktree

Branch convention: any branch containing `<teamkey>-<num>` parses out (e.g. `nishu/non-45-topic` → `NON-45`).

### User-level `CLAUDE.md`

`CLAUDE.md` in this repo is symlinked to `~/.claude/CLAUDE.md` and listed by Claude Code on every project. Per-project decisions still live in each project's own `CLAUDE.md` or `DECISIONS.md`.

## Versioning

SemVer, with a long `0.x` runway:

- **`0.x.0`** — new skill/agent/command, or behavior change downstream projects could feel
- **`0.x.y`** — content edits inside existing files, doc tweaks, `install.sh` fixes
- **`1.0.0`** — when renames stop and the kit feels stable enough to depend on

The "API surface" is skill filenames + frontmatter, agent filenames + `subagent_type` names, slash command names, and `install.sh` behavior. Symlink installs track HEAD by default; `git checkout v0.x.y` before re-running `install.sh` to pin a release.

## Building in public

- [Releases](https://github.com/nonlinearnishu/factory-kit/releases) — the changelog
- [Discussions](https://github.com/nonlinearnishu/factory-kit/discussions) — design questions in the open
- Twitter/X: [@nonlinearnishu](https://x.com/nonlinearnishu) — short threads per minor tag

## License

MIT — see [LICENSE](./LICENSE).
