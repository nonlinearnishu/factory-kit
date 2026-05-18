---
name: factory-commits
description: Commit message and branch convention — Conventional Commits format with a Linear issue reference required in subject or body. Includes the canonical commitlint.config.cjs, Husky hook snippet, and opencommit configuration. Read whenever setting up a new project or wiring AI-assisted commits.
---

# Factory commits

Every commit ties to a Linear issue. We use Conventional Commits as the syntactic frame and Linear's magic words to drive issue automation. This skill is the single source of truth — projects inherit it via the `@commitlint` config below.

## The rule

A commit message MUST:

1. Start with a Conventional Commits header: `<type>(<scope>)?: <subject>` (scope optional).
2. Contain a Linear issue ID (`<TEAM>-<NUM>`, e.g. `NON-45`) somewhere — subject **or** body.
3. Use a Linear magic word + ID for the commit that should close the issue.

A commit message SHOULD:

- Keep the subject under 72 chars, imperative mood, no trailing period.
- Put the *why* in the body when the diff doesn't make it obvious.

## Linear magic words

Use these in the commit body (or PR description) to drive Linear automation. Case-insensitive.

| Effect | Words |
|---|---|
| Closes issue on merge to default branch | `close`, `closes`, `closed`, `closing`, `fix`, `fixes`, `fixed`, `fixing`, `resolve`, `resolves`, `resolved`, `resolving`, `complete`, `completes`, `completed`, `completing`, `implements`, `implemented`, `implementing` |
| Links issue without closing | `ref`, `refs`, `references`, `part of`, `related to`, `contributes to`, `toward`, `towards` |

**Default to a closing word** on the last commit of a branch — that's usually the one that lands on main and you want the ticket to flip to Done automatically.

## Branch convention

`<user>/<teamkey>-<num>-<short-topic>` — lowercase. The `/setup-linear`, `/submit`, and `/close` slash commands all parse the issue ID out of the branch name with `<teamkey>-<num>` (case-insensitive).

Examples:
- `nishu/non-45-commit-conventions` → NON-45
- `nishu/eng-218-rate-limiter-fix` → ENG-218

Get the canonical branch name from Linear: `Cmd+Shift+.` on an issue copies it to clipboard.

## Good vs bad

```
✓ feat(auth): add SSO callback handler

  Closes NON-45.

✓ fix: prevent duplicate org invites (Fixes NON-87)

✓ refactor(forms): extract field registry — refs NON-103

✗ feat: add login flow
   (no Linear ID anywhere — commit-msg hook rejects)

✗ Updates files
   (no type prefix, no scope, no ID)

✗ feat(auth): closes NON-45
   (subject is the magic word; subject should describe the change, magic word lives in body)
```

## commitlint.config.cjs (drop into project root)

```js
/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Conventional Commits: type/scope/subject shape (inherited from extends).
    'subject-case': [2, 'never', ['pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 72],
    'body-leading-blank': [2, 'always'],
    'footer-leading-blank': [2, 'always'],

    // Linear ID required in subject or body (custom rule below).
    'linear-id-present': [2, 'always'],
  },
  plugins: [
    {
      rules: {
        'linear-id-present': (parsed) => {
          const id = /[A-Z][A-Z0-9]+-\d+/;
          const haystack = [parsed.subject, parsed.body, parsed.footer]
            .filter(Boolean)
            .join('\n');
          return [
            id.test(haystack),
            'commit must reference a Linear issue (e.g. NON-45) in subject or body',
          ];
        },
      },
    },
  ],
};
```

Install in the project:

```bash
pnpm add -D @commitlint/cli @commitlint/config-conventional @commitlint/types husky
pnpm exec husky init
echo 'pnpm exec commitlint --edit "$1"' > .husky/commit-msg
chmod +x .husky/commit-msg
```

(Swap `pnpm` for `npm`/`yarn`/`bun` per project.)

## opencommit configuration

The lazygit + opencommit + Ollama setup is the assistant-side complement. Point opencommit at the commitlint config so the model phrases commits to pass our rules:

```bash
oco config set OCO_AI_PROVIDER=ollama
oco config set OCO_MODEL=qwen2.5-coder:3b
oco config set OCO_API_URL=http://localhost:11434
oco config set OCO_PROMPT_MODULE=@commitlint
oco config set OCO_OMIT_SCOPE=true   # model invents bad scopes; let humans add if needed
oco config set OCO_DESCRIPTION=true  # body needed to hold the magic-word + Linear ID
```

The model writes the conventional header; you append the `Fixes NON-XX` line if it didn't infer the ID from branch context. (Future enhancement: a pre-commit step that injects the branch's Linear ID into the body automatically.)

## When the rule doesn't apply

- **The factory-kit itself** — meta-repo, not connected to Linear. Use Conventional Commits but skip the ID requirement. Drop the `linear-id-present` rule from the kit's own `commitlint.config.cjs` (the kit currently doesn't have one — fine).
- **Drive-by typo fixes during another task** — fold into the parent commit; don't create a separate ID-less commit.
- **Initial commit / scaffold commits** — exempt; tag with `chore: initial scaffold`.

## Related

- `factory-pitfalls.md` — "Commits with no Linear linkage" entry
- `~/.claude/commands/submit.md`, `close.md` — depend on the branch convention for issue-ID parsing
