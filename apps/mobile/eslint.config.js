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
  }
]);
