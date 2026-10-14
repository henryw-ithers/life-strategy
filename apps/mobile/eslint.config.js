// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // `.expo` is generated on every start (router types, caches). Linting
    // it reports problems in code nobody wrote and cannot fix, and its
    // router.d.ts carries an eslint-disable for a rule this config does
    // not enable, which is itself an error under reportUnusedDisableDirectives.
    ignores: ["dist/*", ".expo/*"],
  },
  {
    // React Compiler rules that arrived with eslint-config-expo 57 in the
    // SDK 57 upgrade (Phase 0). They flag code that already existed and
    // worked: Reanimated shared values assigned inside gesture worklets
    // (`x.value = …`, which the immutability rule misreads), setState in
    // effects, and memoisation the compiler can't preserve. Most of it is
    // in screens rebuilt in Phases 2–9 (SectionedChecklist, NoteSheet,
    // onboarding, useDayData). Warn for now; switch each back to "error"
    // once the files it flags are rewritten.
    rules: {
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/refs": "warn",
    },
  },
]);
