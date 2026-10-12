#!/bin/bash
# PostToolUse hook for Edit|Write. Enforces the two import boundaries
# AGENTS.md calls absolute, then lints app files the way CI does.
# Exit 2 hands stderr back to Claude so it fixes the file itself.

FILE=$(jq -r '.tool_input.file_path // empty')
[ -z "$FILE" ] || [ ! -f "$FILE" ] && exit 0

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
REL="${FILE#"$ROOT"/}"

case "$REL" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac

IMPORT='(from|import|import\(|require\()[[:space:]]*['"'"'"]'

# ADR-0001: the pure packages never import React Native, Expo or React.
case "$REL" in
  packages/scoring/*|packages/backup/*)
    HITS=$(grep -nE "${IMPORT}(react|react-native|react-dom|expo|@expo|@react-native)(['\"/-])" "$FILE")
    if [ -n "$HITS" ]; then
      echo "Blocked by ADR-0001: $REL is in a pure package and must not import React, React Native or Expo." >&2
      echo "$HITS" >&2
      echo "Move the rule into the package as a pure function, or keep the device half in apps/mobile." >&2
      exit 2
    fi
    ;;
esac

# AGENTS.md: the data layer never imports from components/.
case "$REL" in
  apps/mobile/src/db/*)
    HITS=$(grep -nE "${IMPORT}(@/components|(\.\./)+components)" "$FILE")
    if [ -n "$HITS" ]; then
      echo "Blocked: $REL is in the data layer, which never imports from components/." >&2
      echo "$HITS" >&2
      echo "A rule both need belongs in @glide/scoring or src/lib/." >&2
      exit 2
    fi
    ;;
esac

# Lint app files with the app's own ESLint config (what CI runs).
case "$REL" in
  apps/mobile/.expo/*|apps/mobile/dist/*|apps/mobile/drizzle/*) exit 0 ;;
  apps/mobile/*)
    ESLINT="$ROOT/node_modules/.bin/eslint"
    [ -x "$ESLINT" ] || exit 0
    OUT=$(cd "$ROOT/apps/mobile" && "$ESLINT" --cache --no-warn-ignored --quiet "$FILE" 2>&1)
    if [ $? -ne 0 ]; then
      echo "ESLint errors in $REL (CI runs this lint):" >&2
      echo "$OUT" >&2
      exit 2
    fi
    ;;
esac

exit 0
