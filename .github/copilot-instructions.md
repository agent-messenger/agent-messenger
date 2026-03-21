# Copilot Code Review Instructions

## Documentation Sync

When code under `src/platforms/<platform>/` changes, verify that the corresponding documentation is updated:

| Code Change | Required Doc Update |
|---|---|
| New/modified command in `src/platforms/<platform>/commands/` | `skills/agent-<platform>/SKILL.md` — Commands section |
| Changed output format or fields | `skills/agent-<platform>/SKILL.md` — Output Format section |
| New/changed error codes or messages | `skills/agent-<platform>/SKILL.md` — Error Handling & Troubleshooting sections |
| Auth flow changes (`token-extractor.ts`, `credential-manager.ts`) | `skills/agent-<platform>/references/authentication.md` |
| New workflow patterns or behavioral changes | `skills/agent-<platform>/references/common-patterns.md` |
| New platform or major feature | `docs/content/docs/integrations/<platform>.mdx` and `README.md` |

Flag any PR that modifies platform source code without corresponding documentation updates.

## Skill File Consistency

Each `skills/agent-<platform>/SKILL.md` must:

- Have frontmatter `version` matching `package.json` version (handled by release automation — do not flag version mismatches in PRs)
- Document every subcommand available in the CLI
- Include accurate output format examples that match actual CLI output
- List all supported flags and options for each command

## Code Quality

- No `as any`, `@ts-ignore`, or `@ts-expect-error` type suppressions
- No empty `catch` blocks — all errors must be handled or explicitly re-thrown
- Prefer early returns over deep nesting
- All public functions should have JSDoc comments describing parameters and return values

## Testing

- New commands or features must include corresponding tests
- Bug fixes should include a regression test when feasible
