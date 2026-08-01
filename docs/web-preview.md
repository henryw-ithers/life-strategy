# Web preview

The app runs in a browser so UI changes can be looked at without a
physical device. **Web is a development surface, not a target.** The
product ships to iOS via Expo Go / TestFlight; nothing here implies a
supported web build, and no product decision should be made to
accommodate a browser.

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
