# Web preview

The app runs in a browser so UI changes can be looked at without a
physical device. **Web is a development surface, not a target.** The
product ships to iOS via Expo Go / TestFlight; nothing here implies a
supported web build, and no product decision should be made to
accommodate a browser.

**Backup and restore do not work here.** The cryptography is a native
module wrapping Apple's frameworks
([ADR-0020](adr/0020-backup-cryptography-and-export-exemption.md)),
which a browser has no equivalent of. The screen detects this and says
so. Do not "fix" it with a JavaScript cipher — that would put the app
back under export control (see [release.md](release.md)).

```bash
npm run start -w apps/mobile -- --web
```

Or start the `expo-web` configuration in `.claude/launch.json`, which
runs on port **8090** so a web preview and an Expo Go server (8081) can
be up at the same time.

## Why it needs three pieces of setup

On web, `expo-sqlite` is not SQLite in-process — it is SQLite compiled
to WebAssembly running inside a Web Worker, reached across a
`SharedArrayBuffer`. Three things have to be true before that works,
and all three are load-bearing.

### 1. Cross-origin isolation and `.wasm` resolution

`apps/mobile/metro.config.js` sets `Cross-Origin-Embedder-Policy` and
`Cross-Origin-Opener-Policy` on the dev server, because
`SharedArrayBuffer` only exists in a cross-origin-isolated page, and
adds `wasm` to `resolver.assetExts` so Metro will serve
`wa-sqlite.wasm`. Confirm with `window.crossOriginIsolated === true`.

### 2. The database opens asynchronously on web

Synchronous calls into the worker use a handshake where the main
thread posts a request and then **spins** on `Atomics` waiting for the
answer, since a blocked main thread cannot yield. That spin gives up
after ~1M iterations — about **33ms** in practice.

The worker is a separate Metro bundle (~380 kB) that has to be
fetched, parsed, instantiate a ~600 kB wasm module, and claim an OPFS
access-handle pool. Cold, that measured ~8.8s against the dev server,
and Metro serves the bundle `no-store`, so every reload pays it again.
The first synchronous call therefore cannot win that race.

Native opens the connection at module scope with `openDatabaseSync`,
which meant the timeout fired at *import* time and took out every
route in the app before a screen could render.

So `src/db/client.web.ts` opens through `openDatabaseAsync` instead —
no spin budget, it waits properly — and exports `openDatabase()`, which
the gate in `src/app/_layout.tsx` awaits before mounting anything that
touches the database. Every query after that is synchronous against a
worker that is already warm.

The queries themselves stay synchronous because drizzle's expo-sqlite
driver is sync-only (`prepareSync`, `runSync`, `getAllSync`). Warming
the worker is what makes them work; rewriting callers to `await` would
not have helped.

### 3. A patched `expo-sqlite`

`patches/expo-sqlite+16.0.10.patch` fixes one line in
`web/WorkerChannel.ts`, applied automatically by `patch-package` from
the root `postinstall`.

Upstream writes the result's length header with

```js
resultArray.set(new Uint32Array([length]), 0);
```

where `resultArray` is a `Uint8Array`. `TypedArray.prototype.set`
converts element-wise, so this writes only the **low byte** of the
length, while the reader takes four bytes back. Any synchronous result
of 256 bytes or more came back with a truncated length — 256 reads as
0, 300 reads as 44 — so `JSON.parse` received a clipped or empty
string. A result that is an exact multiple of 256 produced
`Unexpected end of JSON input`.

Because drizzle is sync-only, this made the web path fail on any
non-trivial query. 16.0.10 is the newest release in the 16.x line, so
there is no version to move to while the SDK stays pinned to 54 (see
the root `AGENTS.md`) — hence the patch. Delete it once the SDK moves
and upstream has fixed the framing.

## Skia needs its own entry

The portfolio graph draws with Skia, which in a browser is CanvasKit —
a WebAssembly build that has to be fetched and initialised before any
Skia module is evaluated. Skia's web module reads the `CanvasKit`
global at import time, so loading it later (from a component, or the
root layout) leaves Skia bound to nothing, and the graph throws
`CanvasKit is not defined` or `reading 'PictureRecorder'`.

Two pieces make it work, and both are web-only:

- **`apps/mobile/index.web.js`** is the web entry (`"main": "index"`
  in the app's `package.json`; Metro picks the `.web.js` file for web,
  and native gets `index.js`, which is Expo Router's standard entry).
  It loads CanvasKit, then requires the router. A failed load is
  logged and the app starts anyway — every screen but the graph works.
- **`apps/mobile/public/canvaskit.wasm`** is copied from
  `node_modules/canvaskit-wasm` on install by
  `scripts/setup-skia-web.mjs` (the root `postinstall`), and served
  from the site root. It is ~8 MB and reproducible, so it is
  gitignored rather than committed. If the graph is blank with a 404
  for it in the network tab, run `node scripts/setup-skia-web.mjs`.

## Known gaps on web

These are expected, and are not worth fixing unless web stops being a
preview surface:

- **Notifications are skipped.** Scheduling a local notification has no
  web equivalent and `expo-notifications` throws rather than no-opping,
  which took out the Today tab. `src/notifications/dailyNudge.ts`
  guards on `Platform.OS`.
- **`expo-file-system` is unsupported**, so anything touching photo
  files or backup files warns and does nothing. Photos and `.lsbk`
  backup/restore cannot be exercised in the browser.
- **One tab at a time.** The OPFS access-handle pool is claimed
  per-origin by a single worker, so a second tab open on the same
  origin fails to open the database with `NoModificationAllowedError`.
  Close the other tab — and note that another dev server on the *same*
  port shares that origin.
- **`NumberDial` renders its track but no digits.** The digit strip is
  gated on `containerW > 0`, and the `onLayout` that sets it doesn't
  produce a width here — so the label, the "—" readout and the detent
  indicator all render, and the 1–10 carousel inside them does not.
  Affects every screen that rates something: the diagnostic's
  satisfaction steps, the weekly contentment check-in, and the
  special-day rating in `DayKindSheet`. **Layout and gating can still be
  checked in the browser; the value can only be set on device.**
  Verified as a web-only quirk (the same component behaves identically
  on `/calibration`), not a regression.
