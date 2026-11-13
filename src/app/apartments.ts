import { inject, InjectionToken, makeStateKey, RESPONSE_INIT, TransferState } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { Apartment } from '../beds24/client';

// Provided on the server only, so the Beds24 client stays out of the browser bundle.
export const APARTMENTS = new InjectionToken<() => Promise<Apartment[]>>('apartments');
const key = makeStateKey<Apartment[] | null>('apartments');

export const apartments: ResolveFn<Apartment[] | null> = async () => {
  const state = inject(TransferState);
  const load = inject(APARTMENTS, { optional: true });
  const response = inject(RESPONSE_INIT, { optional: true });
  if (!load) return state.get(key, null);
  const list = await load().catch((error: unknown) => {
    console.error(error);
    return null;
  });
  if (!list && response) response.status = 503;
  state.set(key, list);
  return list;
};
