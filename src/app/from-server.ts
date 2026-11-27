import { inject, makeStateKey, RESPONSE_INIT, TransferState } from '@angular/core';
import { reported } from '../beds24/cache';

// What the server loads from Beds24 for a page, handed on in it, so the browser never calls
// Beds24: null, answered with a 503, where it fails. Called by a resolver.
export function fromServer<T>(name: string, load: (() => Promise<T>) | null) {
  const state = inject(TransferState);
  const key = makeStateKey<T | null>(name);
  const response = inject(RESPONSE_INIT, { optional: true });
  if (!load) return state.get(key, null);
  return load()
    .catch((error: unknown) => {
      if (!reported(error)) console.error(error);
      if (response) response.status = 503;
      return null;
    })
    .then((value) => {
      state.set(key, value);
      return value;
    });
}
