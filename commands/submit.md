---
description: Move the current branch's Linear issue to "In Review"
argument-hint: <issue-id> (optional — auto-detected from branch if omitted)
---

You're handing a ticket off to review. This command moves it to the team's "In Review" state in Linear. It does **not** push code, open a PR, or change git state — those are separate steps the user owns.

**Argument:** `$ARGUMENTS` — optional. If omitted, auto-detect the issue ID from the current branch name.

## What to do

1. **Read `.claude/linear.json`.** If missing, tell the user to run `/setup-linear` first and stop. Pull `teamKey` and `states.inReview` (default `"In Review"`).

2. **Resolve the issue ID.**
   - If `$ARGUMENTS` is provided: normalize it (prepend `<teamKey>-` if numeric).
   - Otherwise: get the current branch with `git rev-parse --abbrev-ref HEAD`. Match against `(\d+)` and construct `<teamKey>-<num>` from the first numeric chunk after the team key (case-insensitive). Example: `nishu/non-45-setup-scaffold` → `NON-45`.
   - If no issue ID can be derived, **ask the user** for it. Don't guess.

3. **Confirm before mutating.**
   - Fetch the issue via `mcp__linear__get_issue` and show: `<KEY-N> — title (current state: <state>)`.
   - Ask the user to confirm the move. If the current state is already `In Review`, say so and stop.

4. **Move the issue.** Call `mcp__linear__save_issue` with `id` and `state` set to the `inReview` value from config. If save_issue requires a state UUID instead of a name, look it up via `mcp__linear__list_issue_statuses` for the team first.

5. **Post a handoff comment** *(optional but default-on)*. Before flipping state, draft a short comment in the `factory-voice.md` shape so the reviewer knows what they're looking at. Density matters — links into the decision graph (PR, related issues, prior comment threads) are what make the comment useful six months later.

   ```
   **Outcome:** <one sentence — what this branch does>
   **Why:** <the underlying constraint or principle>
   **Tradeoff:** <if any>
   **Refs:** <PR URL, related issue IDs, last commit SHA if no PR>
   ```

   Show the draft, ask for approval, then post via `mcp__linear__save_comment`. Skip this step if the user passes `--no-comment` or the issue already has a recent comment from this branch.

6. **Confirm completion.** Print `<KEY-N> moved to In Review.` That's it — no PR side effects.

## Style

Follow `factory-voice.md`. Single confirmation gate per side effect (comment, then state move). Don't narrate intermediate fetches. The handoff comment is the reviewer's entry point — make it parseable at standup speed. If state lookup fails or the team doesn't have an "In Review" state, surface the actual state names and ask which to use.
