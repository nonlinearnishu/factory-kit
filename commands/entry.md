---
description: Load a Linear issue into context and enter plan mode for a focused session
argument-hint: <issue-id> (e.g., NON-45 or 45)
---

You're starting a focused work session on a single Linear issue. Load its context, summarize it, and **enter plan mode** so the user can sign off before you start coding.

**Argument:** `$ARGUMENTS` — the issue identifier. Accept either the full form (`NON-45`) or just the number (`45`). If numeric, prepend the team key from `.claude/linear.json`.

## What to do

1. **Read `.claude/linear.json`.** If missing, tell the user to run `/setup-linear` first and stop. Pull `teamKey` for ID resolution.

2. **Resolve the identifier.** If `$ARGUMENTS` is numeric, construct `<teamKey>-<num>` (e.g., `45` → `NON-45`). If already in `KEY-NN` form, use as-is.

3. **Fetch the issue** via `mcp__linear__get_issue`. Include comments and linked sub-issues if available.

4. **Fetch the project** via `mcp__linear__get_project` if the issue belongs to one and you haven't loaded it yet this session.

5. **Check blockers.** If the issue has open `blockedBy` relations, list them and **warn loudly** before proceeding. Ask whether the user wants to continue or pick a different ticket.

6. **Summarize for context (≤ 250 words):**
   - **Issue:** `<KEY-N> — title` + priority + current state
   - **Goal:** one sentence on what success looks like (paraphrase the description, don't re-quote it whole)
   - **Scope (open checkboxes / acceptance criteria):** the unchecked work items
   - **Constraints / decisions baked in:** anything in the description or comments that locks an approach
   - **Open design calls:** "decide during build" items, ambiguous points worth resolving up front
   - **Related issues:** parent, sub-issues, blockedBy/blocks — just IDs + titles
   - **Linked resources:** PR URLs, attachments, design docs

7. **Enter plan mode.** Call `EnterPlanMode`. Use the loaded context to draft an implementation plan during plan mode — don't start coding until the user exits plan mode with approval.

## Style

Tight bullet points. No marketing copy. Surface non-obvious constraints — invariants, prior decisions, blocking-relation warnings. The reader is *you, two minutes from now, about to design the change* — give yourself what you'd need.
