// Keeps the last good answer. Within `fresh` it is served as it is; after that it is still
// served while a refresh runs behind it, until it is `keep` old and a page has to wait for
// Beds24, or fail. Callers at the same moment share one call.
export function cached<T>(load: () => Promise<T>, fresh: number, keep: number, now = Date.now) {
  let last: { value: T; at: number } | undefined;
  let pending: Promise<T> | undefined;
  const refresh = () =>
    (pending ??= load()
      .then((value) => (last = { value, at: now() }).value)
      .finally(() => (pending = undefined)));
  return async (): Promise<T> => {
    const age = last ? now() - last.at : Infinity;
    if (last && age >= fresh && age < keep && !pending)
      refresh().catch((error: unknown) => console.error('Beds24 refresh failed:', error));
    return last && age < keep ? last.value : refresh();
  };
}
