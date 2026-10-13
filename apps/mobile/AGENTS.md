# Expo notes

This app runs on **Expo SDK 57** (React Native 0.86, React 19.2) as an
**EAS development build** (ADR-0043). Expo Go can't run it: the backup
module is custom native code. Read the versioned docs at
https://docs.expo.dev/versions/v57.0.0/ before writing Expo API code.

- `npm run mobile` starts the dev server for the development build.
- `npm run eas:dev -w apps/mobile` makes a new development build. Only
  needed after a native package or the app config changes.
- Take SDK patch releases with `npx expo install expo@latest --fix`
  from this folder. Never `npm audit fix --force`.

Project-wide conventions live in the repo root AGENTS.md.
