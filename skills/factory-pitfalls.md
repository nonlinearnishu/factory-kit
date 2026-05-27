---
name: factory-pitfalls
description: Cross-skill index of observed failure modes. Each skill carries its own Failure mode blocks under the Principle they violated; this file is the flat scan across all of them, plus process-level pitfalls that don't have a skill home. Read at project kickoff and during code review.
---

# Factory pitfalls

The skills are now structured Principle → Why → Recipe → **Failure mode**, with each anti-pattern co-located with the principle it violates. This file is a flat scan across those failure modes plus process-level pitfalls that don't fit any one skill.

## How to use this skill

- **At project kickoff.** Read this index; ensure the starting setup avoids the top-tier pitfalls (no test coverage, no DECISIONS.md, hardcoded allowlist).
- **In code review.** Scan recent diffs for matches; link the relevant skill section in the PR comment.
- **After incidents.** Add the failure mode to the skill where its principle lives (not here); if it doesn't fit any skill, add a process pitfall below.

## Cross-skill failure index

Each entry: one line, pointing at the skill section that owns it.

### Stack / architecture

- **Mixed tRPC + server actions** — `factory-api.md §API style — pick one`
- **Custom auth adapter when an official one exists** — `factory-auth.md §Better Auth — plugin composition`
- **Triple-fallback auth surface (Clerk → token → header)** — `factory-auth.md §The wrapper interface`
- **No auth at all (`publicProcedure` everywhere)** — `factory-auth.md §Auth from day one`
- **Hardcoded email allowlist** — `factory-auth.md §Hardcoded email allowlists`
- **Admin client at module scope** — `factory-auth.md §Admin client — always wrapped`

### Forms

- **Monolithic 1,500-line form** — `factory-forms.md §Modular section files from day one`

### Testing

- **No tests under `src/`** — `factory-testing.md §Tests-before-merge — coverage gates, not test-first dogma`
- **Mock-only tests passing while prod fails** — `factory-testing.md §Test the boundaries; trust the framework`
- **Snapshot tests as the only coverage** — `factory-testing.md §E2E owns user flows; unit owns behavior`

### Frontend

- **Two-way state-DB sync** — `factory-frontend.md §One direction of truth`
- **Currency formatting drift across views** — `factory-frontend.md §Format helpers`

### Design system

- **Palette-position token names (`primary` / `base-100`)** — `factory-design.md §Token vocabulary — name intent, not palette position`
- **Hex literal in a component file** — `factory-design.md §Token source — CSS variables, bridged into Tailwind`
- **`dark:` variants sprinkled on individual elements** — `factory-design.md §Mode is a variable swap, not a parallel palette`
- **Spacing tokens (`--space-section-y-md`) that duplicate Tailwind's scale** — `factory-design.md §What gets a token, what stays a utility`
- **Components referencing primitive-layer names (`bg-blue-500`) instead of semantic** — `factory-design.md §One layer or two`
- **"I'll lift this later" inline component** — `factory-design.md §Promote drift into a primitive`
- **Token sprawl (60+ tokens, role names diluted into palette-noise)** — `factory-design.md §Hold the line on vocabulary size`
- **Half-replaced theme library coexisting with new tokens** — `factory-design.md §When the existing surface is daisyUI / Bootstrap / Material`

### Data

- **Querying inside JSONB at app speed** — `factory-data-layer.md §Custom attributes as JSONB`
- **Raw SQL with hand-mapped row→object** — `factory-data-layer.md §ORM pick`
- **Mixed migration-file naming** — `factory-data-layer.md §Migration file naming`

### Database migrations (destructive prod writes)

- **Silently coercing historical data to fit a wrong constraint** — `factory-db-migration.md §The data is ground truth`
- **Single-file migration mixing preflight + mutate + verify** — `factory-db-migration.md §Three-stage write contract`
- **Untested rollback shipped to prod** — `factory-db-migration.md §Three-stage write contract`
- **Idempotency claim asserted in a comment, not proven by re-run** — `factory-db-migration.md §Idempotency via natural keys`
- **Natural key with bare `=` on nullable columns** — `factory-db-migration.md §Idempotency via natural keys`
- **Two-branch CASE that conflates NULL with FALSE in tri-state UPDATE** — `factory-db-migration.md §Bidirectional update semantics`
- **Constraint error with no row index — parser didn't validate** — `factory-db-migration.md §Validate at parse, not at constraint`
- **Prod destructive write with no Layer C snapshot taken** — `factory-db-migration.md §Layered backup independence`
- **LLM auto-runs runbook commands "because they're safe"** — `factory-db-migration.md §Human gate at every step`
- **Constraint dropped without auditing downstream layers (server actions, RPC filters, dashboard rollups)** — `factory-db-migration.md §Defense in depth`
- **Local-cycle-then-prod, skipping ephemeral staging** — `factory-db-migration.md §Migration testing protocol`

### Pipelines

- **Pre-built `libs/py-libs/` before second consumer** — `factory-data-pipelines.md §Don't pre-build shared libs`
- **Pydantic models copy-pasted across entry points** — `factory-data-pipelines.md §Three-entry-point pattern`

### LLM workflows

- **Pydantic state for LangGraph** — `factory-llm-workflows.md §State shape`
- **No versioning on editable content (chat vs claims)** — `factory-llm-workflows.md §Version anything editable later`

### Security

- **In-memory rate limiter on serverless** — `factory-security.md §Rate limiting`
- **PHI in email without runtime BAA check** — `factory-security.md §PHI in email/SMS`
- **AI-generated code without a review queue** — `factory-security.md §AI-generated code — read-only by default`

### Deployment

- **Migrations at runtime (in Cloud Run CMD)** — `factory-deployment.md §Migrations — CI, never runtime`

### CI

- **Claude reviewer wired as advisory, not required** — `factory-ci.md §Claude Code reviewer is a required check, not an advisory bot`
- **Required-checks list drifts from workflow jobs** — `factory-ci.md §Branch protection — short list, load-bearing`
- **Pre-push hook treated as the merge gate** — `factory-ci.md §Pre-push hooks — fast feedback, not the gate`

### Observability

- **Regenerated trace IDs at service hops** — `factory-observability.md §Trace ID — propagate, don't regenerate`

### Commits

- **Commits with no Linear linkage** — `factory-commits.md §Tie every commit to a Linear issue`

## Process pitfalls — no skill home

These are kit-shape and project-shape failures that don't fit any one skill's domain. They live here.

### Three competing solutions for the same problem

Legacy `applicationProgress.ts`, intermediate `sectionProgress.ts`, and unified `progress-calculator.ts` all live in the same repo. The newer file is the source of truth but the older ones never got deleted.

**Right move:** when you write a unifier, delete the inputs in the same PR. Half-finished refactors are worse than untouched code — they imply the newer file is the truth while leaving the older ones as plausible alternatives that future contributors will pull from.

### No `DECISIONS.md` per project

Decision-criteria choices (which auth, which UI lib, which API style) get relitigated each session. The kit's `factory-stack.md` documents the criteria; the project's `DECISIONS.md` records the picks.

**Right move:** every new project starts with a `DECISIONS.md` containing one-line entries per decision-criteria choice from `factory-stack.md`. Update on every architectural call.

### Empty `.claude/` or `.agents/` directories

Implies intent without value. New contributors interpret the empty directory as "this is where convention lives" and put unrelated things there.

**Right move:** delete empty stubs. If intent matters, write the placeholder explicitly with `TODO:` so future-you knows what was planned.

### Aspirational docs

`CLAUDE.md` describing the architecture you wish you had, not the one the code actually has. New contributors get the wrong mental model. AI agents read it and propose work against a fiction.

**Right move:** treat `CLAUDE.md` as code. Update in the same PR as the refactor. If you write an `AGENTS.md` or `CLAUDE.md`, make it load-bearing or delete it.

### Inconsistent `CLAUDE.md` formats across repos

Each new project relitigates the format. The kit's template (see `CLAUDE.md` in the kit's root) is the canonical shape — extend it per project, don't reinvent.

**Right move:** copy the kit's `CLAUDE.md` template into the project's root, fill in the project-specific bits (domain, decisions, layout). Same shape every time.
