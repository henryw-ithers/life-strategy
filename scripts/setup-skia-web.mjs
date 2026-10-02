// Copies Skia's WebAssembly build (CanvasKit) into apps/mobile/public,
// where the web preview serves it from the site root
// (apps/mobile/src/lib/graphics.web.ts loads it). Runs on install.
//
// The file is ~7 MB and fully reproducible from node_modules, so it is
// copied rather than committed (see .gitignore). Web is a development
// preview only — iOS never reads it — so a missing source is a warning,
// never an install failure.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "apps", "mobile", "public", "canvaskit.wasm");

let source;
try {
  const require = createRequire(join(root, "apps", "mobile", "package.json"));
  source = join(dirname(require.resolve("canvaskit-wasm/package.json")), "bin", "full", "canvaskit.wasm");
} catch {
  source = null;
}

if (!source || !existsSync(source)) {
  console.warn("setup-skia-web: canvaskit-wasm not found; the web preview's graph will not draw.");
} else {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}
