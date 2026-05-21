# factory-kit

This is the foundation for a "software factory" - Claude skills, agents, and slash commands that are all automatally symlinked into `~/.claude/`. This allows you to pull upon these skills in any repository.

## Why this exists

This repository is a synthesis of learnings across multiple production builds. In each one, I went through a learning journey to understand how to build a production-ready stack. Over countless hours, I tried to understand when and when not to implement specific components. Now, I've pulled my learnings into a set of skills & agents that I can use whenever I start a new project.

This is also becoming a public record of how I am iterating towards a "software factory". Over time, as more code gets generated, I believe the differentiating layer will be the architectural decisions that get made during the build. I want to codify as many of these as I can throughout my journey so that I can consistently come back to them.

## Structure — principles-first, stack-locked recipes

Each `factory-*.md` skill leads each section with the **Principle** (one sentence, stack-agnostic), then **Why** (constraint → option → tradeoff), then **Recipe** (the Next.js / Drizzle / Better Auth / Mantine / Cloud Run shape we use), and a **Failure mode** block when there's one to name. A reader on a different stack can read the principle and why of any section and skip the recipe. The kit is opinionated on the recipe layer and shareable on the principle layer — by structure, not by separate files.

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
npx @nonlinear-labs/factory-kit
```

That's it. The CLI symlinks all skills, subagents, commands, and the user-level `CLAUDE.md` into `~/.claude/`. Restart Claude Code and the kit auto-loads in every project.

`npx @nonlinear-labs/factory-kit` is idempotent — re-run anytime. Existing files at destinations are skipped with a warning; symlinks pointing into the cached package are refreshed.

### Or install from a local clone

```sh
# pin to a release (recommended)
git checkout v0.1.3
./install.sh

# or track HEAD (moving edge)
git checkout main
./install.sh
```

The shell installer and the npx CLI do the same thing; pick whichever fits the workflow.

## What's in here

### Skills (`factory-*.md`)

Synthesized cross-build conventions. Auto-loaded by Claude Code from `~/.claude/skills/`.

| Skill | Domain |
|---|---|
| `factory-voice` | Architect voice, first-principles framing, structured shape for Linear / PR / commit prose (loaded every session) |
| `factory-stack` | Locked + flexible stack decisions, decision criteria |
| `factory-frontend` | DataTable + drawer-CRUD, RowActions, formatters, Mantine vs shadcn |
| `factory-design` | Semantic token vocabulary, CSS-var + Tailwind bridge, dark/light as variable swap, primitives as token consumers, vocabulary-sprawl failure mode |
| `factory-auth` | Better Auth + orgs primary, RLS/Clerk criteria, wrapper interface |
| `factory-data-layer` | Drizzle schema partitioning, multi-tenancy keys, timestamps helper |
| `factory-forms` | react-hook-form + Zod variants, field registry, masked inputs |
| `factory-api` | Server actions vs tRPC criteria; validation; error shape |
| `factory-data-pipelines` | CSV imports, time-series envelopes, Python service entry points |
| `factory-testing` | Vitest + Playwright, `__tests__` co-location, provider wrappers, mock factories, coverage thresholds |
| `factory-llm-workflows` | LangGraph TypedDict state, node factories, RAG, SSE streaming |
| `factory-security` | KMS-at-rest, BAA/PHI, safe redirects, AI-code risk |
| `factory-observability` | PostHog + Sentry day 1, activity logging, trace IDs |
| `factory-deployment` | Vercel + Cloud Run + Terraform conventions |
| `factory-ci` | Single `ci.yml` merge gate, ephemeral PR DB, coverage floor, Claude Code reviewer as required check |
| `factory-commits` | Conventional Commits + required Linear-ID; commitlint config |
| `factory-pitfalls` | Flat cross-skill index of Failure mode blocks + process-level pitfalls without a skill home |

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
- `/release patch|minor|major` — bump VERSION, commit, tag with auto-generated notes (edited in Cursor), push after confirmation

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
- Twitter/X: [@nishu_lahoti](https://x.com/nishu_lahoti) — short threads per minor tag

## License

MIT — see [LICENSE](./LICENSE).
