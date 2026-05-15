---
name: factory-pitfalls
description: Anti-patterns digest — concrete failures from prior builds with one-line lessons. Read at project kickoff and during code review. Each entry links to the relevant factory-*.md skill for the right move. Use as a checklist during PR review.
---

# Factory pitfalls

Each entry: **the anti-pattern → the actual failure → the right move**.

## Stack / architecture

- **Mixing tRPC and server actions in the same project.** Imported tRPC dependencies, never wired the router; dependencies became dead weight. **Right move:** pick a side per project. See `factory-stack.md`.
- **Custom NextAuth Postgres adapter when an official one exists.** Bespoke adapter became permanent technical debt. **Right move:** use the official Better Auth org plugin (or Supabase Auth if RLS-heavy).
- **Three competing solutions for the same problem coexisting.** Legacy `applicationProgress.ts`, intermediate `sectionProgress.ts`, and unified `progress-calculator.ts` all live in the same repo. The newer file is the source of truth but the older ones never got deleted. **Right move:** when you write a unifier, delete the inputs in the same PR.

## Forms

- **Building a monolithic form before sectioning.** A 1,592-line form refactored painfully into 9 section files. **Right move:** modular section files from day one. See `factory-forms.md` (Phase B).
- **CLAUDE.md describing the aspirational architecture instead of actual.** New contributors got the wrong mental model. **Right move:** treat CLAUDE.md as code; update in the same PR as the refactor.

## Frontend

- **No tests under `src/`.** A production-grade CRUD repo with zero test coverage. Nothing to extract as a "testing skill" — tests have to be authored. **Right move:** Vitest + a smoke test for each feature folder from project setup.
- **Inconsistent CLAUDE.md formats** across repos (5 lines / 110 / 163). Each new project relitigates the format. **Right move:** use the factory's `CLAUDE.md` template (Phase B).
- **Two-way state-DB sync (`RouteContext` + auto-persist hook).** Client reducer and DB persistence can desync. **Right move:** one direction of truth — server state via TanStack Query is usually the answer; client reducer is for UI-only transient state. See `factory-frontend.md`.
- **Reaching for DataTable cell-edit when you really want a drawer.** Inline editing is for fast bulk-edit; the drawer is for single-row, multi-field, validated edits.

## Security

- **In-memory rate limiter in production on serverless.** Acknowledged in a code comment but shipped as-is; silently doesn't work across regions. **Right move:** Upstash Redis. See `factory-security.md`.
- **PHI in email without BAA check.** Email helper carried a TODO comment about BAA verification. Comments don't enforce. **Right move:** boot-time / call-time assertion.
- **Hardcoded email allowlist for auth.** Doesn't scale past 10 entries. **Right move:** DB-backed members table from the start.
- **Admin client exposed at module scope.** Easy to misuse. **Right move:** wrap in `withAdmin(fn)`.
- **No auth at all.** An internal tool with `publicProcedure` on every endpoint. **Right move:** auth from day one, even if it's a single shared password.
- **Triple-fallback auth surface.** Clerk → extension token → X-User-ID header. Three things to test, three places to break. **Right move:** one provider per surface.

## Data

- **`libs/py-libs/` pre-built shared utilities.** Empty scaffolding before a second consumer existed. **Right move:** wait for the second consumer. See `factory-data-pipelines.md`.
- **Querying inside JSONB at app speed.** If a field drives a query, it's earned a column. Don't index JSONB in lieu of schema work.
- **Inconsistent migration naming.** Mixing `0000_create_simulations.ts` and `add_vehicle_description.ts`. Hard to read order. **Right move:** pick one convention (timestamps preferred) and stick.
- **Raw SQL with hand-mapped row→object functions.** Verbose, error-prone, no type inference. **Right move:** Drizzle web-side; SQLAlchemy + SoftDelete mixin Python-side.

## LLM workflows

- **Pydantic state for LangGraph.** LangGraph merges state shallowly; Pydantic's nested validation fights this. **Right move:** TypedDict. See `factory-llm-workflows.md`.
- **Routing logic inline in `add_conditional_edges`.** Unreadable, untestable. **Right move:** named `_should_continue_after_*` functions.
- **No message versioning despite claim versioning.** Will need to retrofit if message edits become a feature. **Right move:** version anything that might need editing later; cheap up front, expensive to retrofit.
- **PromptHub as the source of truth (no local fallback).** Breaks offline dev. **Right move:** local prompt string is the source of truth; PromptHub is the override.
- **Shared vector store indexes across tenants.** RBAC at app layer is not enough. **Right move:** per-tenant indexes via Weaviate tenant API or equivalent.

## Process

- **No `DECISIONS.md` per project.** Decision-criteria choices (which auth, which UI lib, which API style) get relitigated each session. **Right move:** every new project starts with a `DECISIONS.md` containing one-line entries per decision-criteria choice from `factory-stack.md`.
- **Empty `.claude/` or `.agents/` directories.** Implies intent without value. **Right move:** delete empty stubs; if intent matters, write the placeholder explicitly with `TODO:` so future-you knows what was planned.
- **`AGENTS.md` as a placeholder.** A one-liner about Next.js breaking changes that doesn't actually teach the conventions. **Right move:** if you write an `AGENTS.md` or `CLAUDE.md`, make it load-bearing or delete it.

## How to use this skill

- **At project kickoff:** read this file and ensure your starting setup avoids the top-tier pitfalls (no test coverage, no DECISIONS.md, hardcoded allowlist, etc.).
- **In code review:** scan recent diffs for matches against this list. If a match is found, link the relevant entry in the PR comment.
- **After incidents:** if a new pitfall is observed, add it here with the actual failure described.
