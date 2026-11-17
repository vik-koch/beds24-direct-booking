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
          throw error;
        },
      )
      .finally(() => (pending = undefined)));
  return async (): Promise<T> => {
    const age = last ? now() - last.at : Infinity;
    const waiting = failed !== undefined && now() - failed.at < pause;
    if (last && age >= fresh && age < keep && !pending && !waiting)
      refresh().catch((error: unknown) => console.error('Beds24 refresh failed:', error));
    if (last && age < keep) return last.value;
    if (waiting) throw failed!.error;
    return refresh();
  };
}
