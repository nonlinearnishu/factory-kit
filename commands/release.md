---
description: Cut a new release — bump VERSION, commit, tag with auto-generated notes, and push. Three approval gates; user edits notes in Cursor.
argument-hint: patch | minor | major (optional — asks if omitted)
---

You're cutting a new release. The user owns the final word at every gate, and edits the release notes directly in their editor (Cursor) — not by prompting you to make changes.

**Argument:** `$ARGUMENTS` — `patch`, `minor`, or `major`. If empty, ask via `AskUserQuestion`.

## What to do

1. **Pre-flight.** Run in parallel:
   - `git status --porcelain` — must be clean. If dirty, list the files and ask whether to abort or stash.
   - `git rev-parse --abbrev-ref HEAD` — confirm we're on the default branch (typically `main`). If not, warn and ask before proceeding.
   - Read `VERSION` at repo root if present. If absent, fall back to `git describe --tags --abbrev=0` (strip leading `v`). If neither exists, treat current as `0.0.0`.

2. **Compute the new version:**
   - `patch`: `X.Y.Z → X.Y.(Z+1)`
   - `minor`: `X.Y.Z → X.(Y+1).0`
   - `major`: `X.Y.Z → (X+1).0.0`

3. **Check for tag collision.** `git rev-parse v<new-version> 2>/dev/null` — if it resolves, fail with a clear message and stop. Don't overwrite an existing tag.

4. **Gather commits since last tag.**
   - Previous tag: `git describe --tags --abbrev=0`. If no tags exist, use the initial commit.
   - Commit list: `git log <prevTag>..HEAD --pretty=format:"%h %s"`.
   - Group by Conventional Commits type: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`. Anything that doesn't fit the format goes under `**other:**` with a flag for the user to rewrite.
   - Identify the dominant theme — largest group, weighted toward user-facing types (`feat` > `fix` > `refactor` > `chore`).
   - Extract any Linear IDs (`<TEAM>-<NUM>`) referenced in commit subjects or bodies.

5. **Write the draft to a file the user can actually edit.** Use the `Write` tool to create `/tmp/factory-kit-release-notes-v<new-version>.md` with this content (auto-fill what you can, leave clear markers where the user needs to refine):

   ```markdown
   **Outcome:** v<new-version> — <one-line summary of the dominant change>

   **Why:** <best-guess from dominant commit type — REFINE THIS>

   **Changes:**

   **feat:**
   - <bulleted list>

   **fix:**
   - <bulleted list>

   **chore:**
   - <bulleted list>

   <omit any empty group entirely>

   **Refs:** <Linear IDs from commits — omit line if none>
   ```

6. **Open it in Cursor.** Run `cursor /tmp/factory-kit-release-notes-v<new-version>.md` via Bash. If `cursor` isn't on PATH, fall back to `$EDITOR` or tell the user the path and ask them to open it manually.

7. **Gate 1 — wait for the user.** Print:
   > Draft is open in Cursor: `/tmp/factory-kit-release-notes-v<new-version>.md`. Edit anything you want — `Why`, `Outcome`, the bullets, all of it. Save the file and reply `done` (or `cancel` to abort).

   Wait for the user's reply. On `cancel`, delete the temp file and stop.

8. **Read back what they saved.** Use the `Read` tool on the temp file. Print a brief diff summary (or just the final content if the diff would be longer than the file). Extract the **Outcome** line's summary fragment (the text after `— `) to use as the commit subject. Ask one final confirmation:
   > Final notes shown above. Confirm to write the commit + tag, or reply with another round of edits and I'll wait again.

9. **Gate 2 — write.** On confirmation:
   - Write the new version to `VERSION` (only if the file existed before).
   - `git add VERSION` (only if applicable).
   - `git commit -m "release: v<new-version> — <outcome-summary>"` — the summary comes from the **Outcome** line in the notes. Keep the full header ≤ 72 chars (truncate the summary if needed, full text is in the tag annotation).
   - `git tag -a v<new-version> -F /tmp/factory-kit-release-notes-v<new-version>.md` — pass the file directly so multi-line formatting is preserved.

10. **Gate 3 — push?** Show local state (`git log -1 --oneline`, `git tag --list 'v*' | tail -3`) and ask explicitly whether to push. Don't pre-authorize. On yes:
    - `git push origin HEAD`
    - `git push origin v<new-version>`

11. **Clean up and confirm.** Delete `/tmp/factory-kit-release-notes-v<new-version>.md`. Print:
    > Released v<new-version>. Tag pushed *(if approved)*. Run `git show v<new-version>` to verify the annotation.

## Style

Follow `factory-voice.md`. Three explicit gates — notes (edited in Cursor), write (commit + tag), push — none batched, none skipped. The auto-grouped Conventional Commits list IS the changelog; don't editorialize it. Architect judgment goes on the Outcome and Why lines, which the user will rewrite in their editor. If a commit was pushed with `--no-verify` and doesn't fit the conventional format, surface it under `**other:**` so the user can decide how to characterize it.

## Related

- `factory-commits.md` — the Conventional Commits format this command parses
- `factory-voice.md` — the shape used for release notes
