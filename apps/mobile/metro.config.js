const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Let Metro resolve drizzle's .sql migration files as source.
config.resolver.sourceExts.push("sql");

// expo-sqlite on web ships SQLite as WebAssembly (wa-sqlite.wasm);
// Metro must treat .wasm as an asset to resolve it.
config.resolver.assetExts.push("wasm");

// wa-sqlite needs SharedArrayBuffer, which browsers only enable under
// cross-origin isolation. These headers apply to the dev server only.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    middleware(req, res, next);
  },
};

module.exports = config;
