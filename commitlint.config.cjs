/**
 * Factory-kit's own commitlint config.
 *
 * Conventional Commits + subject hygiene, but no `linear-id-present` rule —
 * the kit itself isn't connected to Linear (per factory-commits.md's exemption).
 * Projects spun up from the kit copy the fuller config in factory-commits.md
 * which adds the Linear-ID requirement.
 *
 * @type {import('@commitlint/types').UserConfig}
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [2, 'never', ['pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 72],
    'body-leading-blank': [2, 'always'],
    'footer-leading-blank': [2, 'always'],
    'type-enum': [
      2,
      'always',
      ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'release', 'revert', 'style', 'test'],
    ],
  },
};
