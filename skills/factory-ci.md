---
name: factory-ci
description: CI and pull-request review conventions. One canonical `.github/workflows/ci.yml` is the merge gate (typecheck, lint, test, build, claude-review); branch protection's required-checks list matches the job list 1:1; `anthropics/claude-code-action@v1` reviews every PR against the `factory-pitfalls.md` checklist as a required check, not advisory. Deploy workflows live separately and never gate merge. Read at project kickoff and whenever wiring CI on a new repo.
---

# Factory CI

Each section leads with **Principle** (one sentence, stack-agnostic), then **Why** (constraint → option → tradeoff), then **Recipe** (the GitHub Actions / branch protection / Claude reviewer shape we use), and **Failure mode** when there's one to name.

The kit is opinionated on the recipe layer (GitHub Actions + `anthropics/claude-code-action`). A reader on GitLab / Buildkite can read the principle and skip the recipe; the merge-gate, required-check, and automated-review principles are stack-agnostic.

## One canonical workflow gates merge

**Principle.** A single `.github/workflows/ci.yml` is the merge gate; nothing else gates merge; branch protection's required-checks list matches that workflow's jobs 1:1.

**Why.** Multiple workflows that each "kind of" gate merge create ambiguity — when a PR is red, no one knows which job to look at, and a "flaky" job becomes optional in practice within a week. A single canonical file is the source of truth; the required-checks list is the contract with reviewers. The trade-off accepted: the single file gets longer than any individual concern's natural footprint; that's the cost of one place to look.

**Recipe.** `ci.yml` has exactly these jobs: `typecheck`, `lint`, `test`, `build`, `claude-review`. Each is a required check in branch protection. Deploy lives in `deploy.yml` (see `factory-deployment.md`) and is *never* a required check on PRs — deploy gates the next environment, not the merge.

```yaml
# .github/workflows/ci.yml
name: ci

on:
  pull_request:
    types: [opened, synchronize, reopened]
  push:
    branches: [main]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

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
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:migrate
        env:
          DATABASE_URL: ${{ steps.neon.outputs.db_url }}
      - run: pnpm test:coverage
        env:
          DATABASE_URL: ${{ steps.neon.outputs.db_url }}

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

`claude-review` lives in its own file (`claude-review.yml`) because the action has different permission needs; both files together constitute "the merge gate."

## Ephemeral DB per PR

**Principle.** Every PR's tests run against a fresh database branched from `main`, deleted on PR close.

**Why.** Shared dev DBs are the canonical source of false failures — schema drift between PRs, stale rows from prior runs, parallel-PR collisions. Ephemeral DBs make the failure mode "the test didn't pass against a clean state derived from main," which is the failure mode worth catching. Anything else (a flaky shared DB) is noise that erodes trust in the gate.

**Recipe.** Cross-reference: `factory-deployment.md §GitHub Actions — ephemeral DBs + matrix deploy` owns the `neondatabase/create-branch-action` snippet. The `test` job in the recipe above uses it. Do not duplicate the recipe here; the deploy skill owns the Neon integration.

## Coverage floor enforced in CI

**Principle.** `vitest --coverage` runs with thresholds defined in `vitest.config.ts`; CI fails if coverage drops below the floor; the threshold is not overridden at the CI layer.

**Why.** A coverage gate without enforcement is a number on a dashboard that no one reads. Enforcement in the merge gate is what makes the floor load-bearing — the floor only protects you on the diff that crosses it. The trade-off accepted: writing a feature without the test now blocks merge instead of "we'll come back to it"; the time saved on archeological debugging compounds.

**Recipe.** Add `test:coverage` to package.json scripts; the threshold lives in the config (see `factory-testing.md §Tests-before-merge — coverage gates, not test-first dogma` for the `vitest.config.ts` shape), not in the CI command:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

CI calls `pnpm test:coverage`. No `--coverage.thresholds.lines=0` overrides. If the floor needs to move, edit the config in a PR with the diff that justifies the move.

## Claude Code reviewer is a required check, not an advisory bot

**Principle.** Every PR is reviewed by `anthropics/claude-code-action@v1`, primed with the kit's `factory-pitfalls.md` checklist plus the repo's `CLAUDE.md`; the bot's check is a required check in branch protection, not an advisory comment people can ignore.

**Why.** An advisory reviewer that "people read sometimes" is decorative — humans triage Slack first, GitHub second, and the second time a reviewer bot posts a generic nitpick, the team filters it out. A required check forces the conversation: either the bot's finding is wrong (and you mark the comment resolved with a reason) or it's right (and you fix it before merge). The cost is per-PR API spend, which is dwarfed by the cost of one bug that the kit's pitfalls digest would have caught. The trade-off accepted: a noisy reviewer can block merges; the right move is to tune the prompt, not to demote the check.

**Recipe.** A dedicated workflow file. The action is `anthropics/claude-code-action@v1` (Anthropic's pinned major-version tag, blessed in their own README); the prompt loads `factory-pitfalls.md` as the checklist and the repo's `CLAUDE.md` for project-specific decisions.

```yaml
# .github/workflows/claude-review.yml
name: claude-review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            REPO: ${{ github.repository }}
            PR NUMBER: ${{ github.event.pull_request.number }}

            You are reviewing a pull request against the factory-kit conventions.

            Load the project's CLAUDE.md and the kit's factory-pitfalls.md as your
            checklist. For each anti-pattern in the pitfalls index, scan the diff
            for matches and flag them with a link to the owning skill section.

            Focus areas (in order):
            1. Anti-patterns listed in factory-pitfalls.md — these are non-negotiable
            2. Security: secrets in code, missing auth on procedures, admin-client
               at module scope, hardcoded allowlists, AI-generated code without
               a review queue (see factory-security.md)
            3. Data layer: queries without WHERE clauses, JSONB used for indexable
               data, missing org-keyed FKs (see factory-data-layer.md)
            4. Testing: changes to src/ without corresponding tests under __tests__/
               (see factory-testing.md)
            5. Conventions: format helpers used as single source, semantic color
               tokens, drawer-CRUD pattern (see factory-frontend.md)

            For each finding, post an inline comment with:
            - Severity: `high` (blocks merge), `medium` (fix before merge),
              or `nit` (suggestion)
            - The pitfall name and a link to the owning skill section
            - A concrete suggested change

            Use `mcp__github_inline_comment__create_inline_comment` (with
            `confirmed: true`) for specific code issues. Use `gh pr comment`
            only for the high-level summary at the end.

            Exit non-zero if any finding is severity `high`.

          claude_args: |
            --allowedTools "mcp__github_inline_comment__create_inline_comment,Bash(gh pr comment:*),Bash(gh pr diff:*),Bash(gh pr view:*)"
```

Secrets required: `ANTHROPIC_API_KEY`. Permissions are tight: `contents: read`, `pull-requests: write`, `id-token: write` — the bot reads code and writes review comments; it does not push to branches.

**Pin policy.** `@v1` is Anthropic's blessed major-version pin; it advances within v1.x as the action's API stays compatible. Never pin to `@main` (rolling, breaks unexpectedly). When v2 ships, pin `@v2` after reading the migration guide; do not auto-bump.

**Failure mode.** Claude reviewer wired as an advisory job (no required check, `continue-on-error: true`, or removed from branch protection) → the team learns the bot is optional within two weeks; the kit's pitfalls digest stops reviewing diffs; the gate becomes whatever humans noticed. Right move: when the bot is noisy, tune the prompt (narrower scope, sharper severity definitions) — never demote it to advisory.

## Branch protection — short list, load-bearing

**Principle.** The required-checks list is short, every entry is non-negotiable, and the list is documented in the repo's `CLAUDE.md` so new contributors see the contract.

**Why.** A long required-checks list is impossible to maintain — every flaky job becomes "we can merge anyway" within a sprint, and the list rots into a lie. A short list (typecheck, test, build, claude-review) is defensible because every entry has a clear failure mode it catches. Un-documented branch protection is tribal knowledge that disappears with the first contributor turnover. The trade-off accepted: setting up branch protection is one-time toil; the contract is durable.

**Recipe.** The repo's `CLAUDE.md` includes a `## Branch protection` section enumerating:

- **Required checks:** `typecheck`, `lint`, `test`, `build`, `claude-review`
- **Require linear history:** yes (no merge commits on `main`)
- **Require pull request before merging:** yes (no direct push to `main`)
- **Dismiss stale reviews on new commits:** yes
- **Restrict who can push to `main`:** repo admins only

Apply via GitHub UI (Settings → Branches → Add rule) or via Terraform / `gh api` for IaC repos. If the required-checks list ever drifts from the workflow's job list, the CI job is missing from branch protection or vice versa — fix in the same PR as the workflow change.

**Failure mode.** Required-checks list drifts from workflow jobs → either a renamed job is silently optional (no check named, no enforcement) or a removed job still blocks (no run produces it, PRs stuck pending forever). Right move: when renaming or removing a CI job, edit branch protection in the same PR.

## Pre-push hooks — fast feedback, not the gate

**Principle.** Local hooks (Husky + lint-staged) run typecheck + lint at pre-push as a developer convenience; the gate is CI, not the local hook.

**Why.** The gate must be CI because CI is the only environment we trust to be reproducible — local environments differ in node versions, installed binaries, and uncommitted state. Local hooks save round-trips when they catch the obvious failure before the PR; they cannot replace the gate because developers can `--no-verify` and CI cannot. The trade-off accepted: hooks are duplicate work that runs twice (locally and in CI); the local run is fast and saves a CI round-trip when it catches something.

**Recipe.** Husky is already wired by `factory-commits.md §commitlint config — the canonical drop-in` for `commit-msg`. Add a `pre-push` hook in the same `.husky/` directory:

```bash
# .husky/pre-push
pnpm typecheck
pnpm lint-staged
```

Install `lint-staged` and configure it in `package.json` to run prettier + eslint --fix on changed files only — not the whole repo, which is slow and frustrating at push time.

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["prettier --write", "eslint --fix"],
    "*.{md,json}": ["prettier --write"]
  }
}
```

**Failure mode.** Pre-push hook treated as the merge gate ("the hook ran, we're good") → developer who used `--no-verify` lands code CI would have caught, but CI doesn't run because branch protection wasn't configured. Right move: branch protection is the gate; the hook is the speed bump. Never trust a check that runs on the same machine as the change.

## Source patterns

The matrix-deploy half is from Encode/monorepo (GitHub Actions, ephemeral Neon branches, matrix-deploy on merge). The Claude reviewer is **new** in the factory as of this skill — no client repo has it wired yet; this is the baseline that future projects start from. Branch protection conventions are aggregated from the kit's accumulated experience rather than any one source repo.

## Related

- `factory-testing.md` — defines what `pnpm test:coverage` enforces (Vitest config, coverage thresholds)
- `factory-deployment.md` — owns the deploy half of the workflow (deploy-web, deploy-python); see §GitHub Actions — ephemeral DBs + matrix deploy for the Neon branch action snippet
- `factory-pitfalls.md` — the checklist the Claude reviewer is primed with
- `factory-commits.md` — owns the `commit-msg` Husky hook this skill extends with `pre-push`
- `factory-security.md` — the audit lens the Claude reviewer applies via the prompt's focus areas
