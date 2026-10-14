const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Let Metro resolve drizzle's .sql migration files as source.
config.resolver.sourceExts.push("sql");

// expo-sqlite on web ships SQLite as WebAssembly (wa-sqlite.wasm);
// Metro must treat .wasm as an asset to resolve it.
config.resolver.assetExts.push("wasm");

// wa-sqlite needs SharedArrayBuffer, which browsers only enable under
// cross-origin isolation, so every dev-server response needs these two
// headers, the HTML page above all. Since SDK 56 the Expo CLI serves the
// page from its own middleware, registered before Metro's, so wrapping
// Metro's middleware no longer reaches it. Instead, the first time the
// dev server calls enhanceMiddleware, add the headers to every response
// it writes. enhanceMiddleware only runs in the dev server, so builds
// and exports are untouched. See docs/web-preview.md.
const ISOLATION_HEADERS = {
  "Cross-Origin-Embedder-Policy": "credentialless",
  "Cross-Origin-Opener-Policy": "same-origin",
};
let isolationInstalled = false;
function installIsolationHeaders() {
  if (isolationInstalled) return;
  isolationInstalled = true;
  const { ServerResponse } = require("http");
  const writeHead = ServerResponse.prototype.writeHead;
  ServerResponse.prototype.writeHead = function (...args) {
    if (!this.headersSent) {
      for (const [name, value] of Object.entries(ISOLATION_HEADERS)) {
        if (!this.hasHeader(name)) this.setHeader(name, value);
      }
    }
    return writeHead.apply(this, args);
  };
}
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    installIsolationHeaders();
    return middleware;
  },
};

module.exports = config;
