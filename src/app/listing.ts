import { inject, InjectionToken } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { Listing } from '../beds24/client';
import site from '../content/generated/site';
import { fromServer } from './from-server';

// Provided on the server only, so the Beds24 client stays out of the browser bundle.
export const LISTING = new InjectionToken<(roomId: number) => Promise<Listing>>('listing');

// The listing carries every language's texts, so a change of language needs no new answer.
export const listing: ResolveFn<Listing | null> = (route) => {
  const slug: string = route.params['slug'];
  const load = inject(LISTING, { optional: true });
  const { roomId } = site.apartments.find((apartment) => apartment.slug === slug)!;
  return fromServer(`listing ${slug}`, load && (() => load(roomId)));
};
