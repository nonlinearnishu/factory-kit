---
description: Close out a Linear issue — move to Done, add a closing comment, and clean up the local branch/worktree
argument-hint: <issue-id> (optional — auto-detected from branch if omitted)
---

You're finishing a ticket. This command:
1. Drafts a closing comment summarizing what shipped
2. Moves the Linear issue to `Done`
3. Cleans up the local branch and worktree

It does **not** merge a PR or push code — that's expected to have happened already.

**Argument:** `$ARGUMENTS` — optional. If omitted, auto-detect from the current branch name.

## What to do

1. **Read `.claude/linear.json`.** If missing, tell the user to run `/setup-linear` first and stop. Pull `teamKey` and `states.done` (default `"Done"`).

2. **Resolve the issue ID** the same way `/submit` does:
   - Argument provided → normalize (prepend `<teamKey>-` if numeric).
   - Otherwise → parse current branch (`git rev-parse --abbrev-ref HEAD`) for `<teamKey>-<num>` (case-insensitive).
   - If nothing matches, ask the user.

3. **Pre-flight checks.** Run these in parallel, surface what they show, and **gate on user confirmation before mutating anything**:
   - `git status` — any uncommitted changes? If yes, warn and ask before proceeding.
   - `git log <main-or-default>..HEAD --oneline` — commits since divergence. Use this for the closing comment.
   - `git diff --stat <main-or-default>...HEAD` — top-level files touched.
   - Linked PR state if discoverable (look at `mcp__linear__get_issue` attachments, or `gh pr list --head <branch>`). If a PR exists and isn't merged, warn — `/close` is normally a post-merge action.

4. **Draft the closing comment** (≤ 150 words):
   - **What shipped** — one or two lines on the outcome (not a diff dump).
   - **Decisions made** — non-obvious tradeoffs worth recording for future readers. Skip if the diff is self-explanatory.
   - **Deferred / follow-ups** — anything punted, with a one-line reason. Skip if nothing.
   - **PR / commit:** link if applicable.

5. **Show the draft and ask for approval.** The user can edit tone or pull anything sensitive before it lands in Linear.

6. **On approval, in this order:**
   - Post the comment: `mcp__linear__save_comment` with `issueId` and `body`.
   - Move the issue to Done: `mcp__linear__save_issue` with `id` and `state` set to the `done` value from config (look up state UUID via `list_issue_statuses` if names aren't accepted).

7. **Clean up local state.** Confirm once more before any branch-deletion step — destructive operations aren't pre-authorized.
   - If the current directory is a worktree (`git rev-parse --show-toplevel` differs from the main repo root): use `ExitWorktree` to merge back or discard per user choice.
   - Otherwise: `git checkout main` (or the project's default branch) then `git branch -d <branch>`. Use `-D` only if `-d` refuses and the user explicitly approves (work is unmerged, confirm intent).

8. **Confirm completion.** Print: `<KEY-N> closed. Branch deleted. Worktree exited (if applicable).`

## Style

Three gates: pre-flight review → closing comment approval → branch deletion confirmation. Don't skip any of them. If the issue is already `Done`, still offer the cleanup steps (sometimes Linear gets updated before the branch does).
