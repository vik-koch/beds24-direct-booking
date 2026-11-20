const logged = new WeakSet<object>();
// An error the cache has logged already, once for every page that is answered without Beds24.
export const reported = (error: unknown) => error instanceof Object && logged.has(error);

// Keeps the last good answer. Within `fresh` it is served as it is; after that it is still
// served while a refresh runs behind it, until it is `keep` old and a page has to wait for
// Beds24, or fail. Callers at the same moment share one call, and after a failed call none
// is made for `pause`, so an outage does not spend Beds24's credits on every page view.
export function cached<T>(
  load: () => Promise<T>,
  fresh: number,
  keep: number,
  pause: number,
  now = Date.now,
) {
  let last: { value: T; at: number } | undefined;
  let pending: Promise<T> | undefined;
  let failed: { error: unknown; at: number } | undefined;
  const refresh = () =>
    (pending ??= load()
      .then(
        (value) => {
          failed = undefined;
          return (last = { value, at: now() }).value;
        },
        (error: unknown) => {
          failed = { error, at: now() };
          console.error(`Beds24 refresh failed: ${error instanceof Error ? error.message : error}`);
          if (error instanceof Object) logged.add(error);
          throw error;
        },
      )
      .finally(() => (pending = undefined)));
  return async (): Promise<T> => {
    const age = last ? now() - last.at : Infinity;
    const waiting = failed !== undefined && now() - failed.at < pause;
    if (last && age >= fresh && age < keep && !pending && !waiting)
      refresh().catch(() => undefined);
    if (last && age < keep) return last.value;
    if (waiting) throw failed!.error;
    return refresh();
  };
}
