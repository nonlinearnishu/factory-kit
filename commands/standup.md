---
description: Dev standup — open Linear tickets grouped by in-flight, top priority, and backlog
---

You're giving the user a dev-standup view of their open Linear work in this project. The goal is to answer *"what's in flight, what's the top priority, what's waiting?"* without making them open Linear in a browser.

## What to do

1. **Read `.claude/linear.json`** from the project root. If missing, tell the user to run `/setup-linear` first and stop.

2. **Resolve scope.** Pull `teamId` from the config. If `projectId` is present, scope to that project; otherwise stay team-wide.

3. **List open issues** via `mcp__linear__list_issues`:
   - `team: <teamId>`
   - `project: <projectId>` (if present in config)
   - `state` filtered to open states only (exclude `Done`, `Completed`, `Cancelled`, `Duplicate`)
   - Sort by priority (Urgent → High → Normal → Low), then by updated date desc

4. **Return a tight status (≤ 300 words):**

   **Project:** name + active milestone if present, or just team name if no project scope

   **In progress** — issues in `In Progress` (or whatever the team's equivalent active state is). One line per issue: `<TEAM-N> — title (assignee if not me)`.

   **In review** — issues in `In Review`. Same format. Surface stale ones (> 3 days).

   **Top priority (next up)** — `Urgent` and `High`-priority open issues not yet started. Order by priority then update date. Show 5–8.

   **Backlog** — count + a sample of 3–5 from `Todo`/`Backlog` states, prioritized.

   **Blocked** *(only if any)* — issues with open `blockedBy`. Show what's blocking each.

   **One-line recommendation:** the single best issue to pick up next, given priority and blockers. Cite as `/entry <TEAM-N>`.

## Style

Follow `factory-voice.md`. Tight, glanceable lines — the user is scanning for a decision (what to pick up), not reading a report. Don't reprint full descriptions; titles only. Always cite issue IDs in canonical form (e.g., `NON-45`) so they paste straight into `/entry`. The recommendation at the end is a call, not a suggestion — name the reason in one clause ("highest priority, no blockers" / "in review > 3 days, unblock the reviewer first").
