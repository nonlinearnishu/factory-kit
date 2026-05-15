---
description: One-time bootstrap — write `.claude/linear.json` so /standup, /entry, /submit, /close know which team & project to use
---

You're configuring this project to use the Linear command set (`/standup`, `/entry`, `/submit`, `/close`). The other commands read `.claude/linear.json` from the project root — this command creates it.

## What to do

1. **Check if config already exists.** Read `.claude/linear.json`. If it's present, show the current contents and ask whether the user wants to overwrite, edit, or abort.

2. **Discover Linear context.** Use Linear MCP tools to help the user pick:
   - `mcp__linear__list_teams` — list teams the user has access to. Show `key — name (id)` lines.
   - Ask which team to use (AskUserQuestion). Capture both `key` (e.g., `NON`) and `id` (UUID).
   - `mcp__linear__list_projects` filtered to the chosen team — optional. Ask if the user wants to scope `/standup` to a specific active project; "no" is fine and means team-wide.
   - If a project is chosen, capture `id` and `name`.

3. **Confirm state names.** Defaults are `"In Review"` and `"Done"`. Run `mcp__linear__list_issue_statuses` for the chosen team and verify both names exist. If not, ask the user for the actual names used by their team.

4. **Write `.claude/linear.json`** with this shape:

   ```json
   {
     "teamKey": "NON",
     "teamId": "<uuid>",
     "projectId": "<uuid-or-omit>",
     "projectName": "<name-or-omit>",
     "states": {
       "inReview": "In Review",
       "done": "Done"
     },
     "branchPattern": "<owner>/<teamKey-lower>-<number>-<topic>"
   }
   ```

   - `projectId` / `projectName` are optional — omit the keys entirely if the user didn't pick a project.
   - `branchPattern` is documentation-only — `/submit` and `/close` parse the branch with a regex (`-(\d+)-`) and don't depend on this string. Include it so future readers know the convention.

5. **Show the file path and confirm** — print "Wrote .claude/linear.json. You can now use /standup, /entry <issue>, /submit, /close." Don't commit it (the user decides whether to check it in).

## Style

Direct, minimal back-and-forth. If the user has only one team, skip the question — just use it. If they don't pick a project, that's fine — many repos don't have one.
