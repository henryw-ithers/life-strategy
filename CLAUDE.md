@AGENTS.md

## Claude Code

This file exists so the root AGENTS.md always loads. Without it, a
session opened in `apps/mobile/` finds that folder's CLAUDE.md and
skips the root AGENTS.md, which holds the product invariants. Put
project rules in AGENTS.md, not here, so every coding agent sees them.

- `.claude/settings.json` hooks every edit: pure packages may not
  import React Native or Expo, `src/db/` may not import `components/`,
  and app files are linted. A blocked edit says which rule fired.
- Before calling a change to scoring, grading, copy or the commitment
  model done, run the `invariant-reviewer` subagent on the diff.
- `/new-adr` drafts the next ADR from the template and adds its index
  row.
- Five generic reviewers and the `accessibility` skill are copied from
  ECC (github.com/affaan-m/ECC, v2.2.3, MIT — `.claude/ECC-LICENSE`):
  `typescript-reviewer`, `react-reviewer`, `silent-failure-hunter`,
  `type-design-analyzer`, `pr-test-analyzer`. They know nothing of
  this app; where they disagree with AGENTS.md or an ADR, those win.
  ECC's rule packs are deliberately not used.
- The ECC plugin is installed (2026-10-13) for its commands, used by
  the redesign runbook: `/ecc:plan`, `/ecc:build-fix`,
  `/ecc:tdd-workflow`, `/ecc:refactor-clean`, `/ecc:test-coverage`,
  `/ecc:update-docs`. Its hooks are meant to stay off. If GateGuard
  asks for "facts" before a command, it is still on: run with
  `ECC_GATEGUARD=off` or add its hook to `ECC_DISABLED_HOOKS`.
- When compacting, keep the list of files changed and which of
  `npm test`, `npm run typecheck` and `npm run lint` have passed.
