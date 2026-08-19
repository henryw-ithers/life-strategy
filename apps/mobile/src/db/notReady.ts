/**
 * A stand-in for a database connection that does not exist yet.
 *
 * Both builds open asynchronously, so both need something for `sqlite`
 * and `db` to hold between module evaluation and the open resolving.
 * Every operation on the stand-in throws the same explanation, so a
 * query that slips past the startup gate reports the actual mistake
 * instead of failing later as "undefined is not an object".
 *
 * Shared by [client.ts](client.ts) and [client.web.ts](client.web.ts)
 * because the contract is identical on both: nothing may touch the
 * connection until `openDatabase()` has resolved. It lived in the web
 * client alone while native opened at import time and had no gap to
 * cover; native now has the same gap, and one copy of a rule is easier
 * to keep true than two.
 */
export function notReady<T extends object>(name: string): T {
  const fail = (): never => {
    throw new Error(
      `Life Strategy: "${name}" was used before the database finished ` +
        `opening. Await openDatabase() first — the startup gate in ` +
        `src/app/_layout.tsx does this before any screen renders.`,
    );
  };
  return new Proxy({} as T, { get: fail, set: fail, has: fail, apply: fail });
}
