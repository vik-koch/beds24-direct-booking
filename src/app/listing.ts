import { inject, InjectionToken, makeStateKey, RESPONSE_INIT, TransferState } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { reported } from '../beds24/cache';
import type { Listing } from '../beds24/client';
import site from '../content/generated/site';

// Provided on the server only, so the Beds24 client stays out of the browser bundle.
export const LISTING = new InjectionToken<(roomId: number) => Promise<Listing>>('listing');

// The listing carries every language's texts, so a change of language needs no new answer.
export const listing: ResolveFn<Listing | null> = async (route) => {
  const slug: string = route.params['slug'];
  const state = inject(TransferState);
  const key = makeStateKey<Listing | null>(`listing ${slug}`);
  const load = inject(LISTING, { optional: true });
  const response = inject(RESPONSE_INIT, { optional: true });
  if (!load) return state.get(key, null);
  const { roomId } = site.apartments.find((apartment) => apartment.slug === slug)!;
  const value = await load(roomId).catch((error: unknown) => {
    if (!reported(error)) console.error(error);
    return null;
  });
  if (!value && response) response.status = 503;
  state.set(key, value);
  return value;
};
