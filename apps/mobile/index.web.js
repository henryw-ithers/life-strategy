// The web preview's entry (docs/web-preview.md). Expo Router's own
// entry, with one step first: load CanvasKit, Skia's WebAssembly build.
//
// Skia's web module reads the CanvasKit global when it is first
// imported, so CanvasKit has to exist before any route that draws the
// portfolio graph is evaluated — loading it later, from a component,
// leaves Skia bound to nothing. Hence the router is required, not
// imported, once the load settles.
//
// The binary is copied into public/ on install
// (scripts/setup-skia-web.mjs). A failed load is not fatal: every
// screen but the graph still works, and web is a preview only.

// `@expo/metro-runtime` must be the first import for Fast Refresh.
import "@expo/metro-runtime";
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

LoadSkiaWeb({ locateFile: (file) => `/${file}` })
  .catch((error) => {
    console.warn("Skia (CanvasKit) did not load; the portfolio graph will not draw.", error);
  })
  .finally(() => {
    const { App } = require("expo-router/build/qualified-entry");
    const { renderRootComponent } = require("expo-router/build/renderRootComponent");
    renderRootComponent(App);
  });
