import { inject, InjectionToken, makeStateKey, RESPONSE_INIT, TransferState } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { FreeWeeks } from '../beds24/weeks';

// Provided on the server only, so the Beds24 client stays out of the browser bundle. With a
// slug, the weeks of that apartment alone, for its page's booking panel.
export const FREE_WEEKS = new InjectionToken<(slug?: string) => Promise<FreeWeeks>>('free weeks');

export const weeks: ResolveFn<FreeWeeks | null> = async (route) => {
  const slug: string | undefined = route.params['slug'];
  const state = inject(TransferState);
  const key = makeStateKey<FreeWeeks | null>(`free weeks ${slug ?? ''}`);
  const load = inject(FREE_WEEKS, { optional: true });
  const response = inject(RESPONSE_INIT, { optional: true });
  if (!load) return state.get(key, null);
  const list = await load(slug).catch((error: unknown) => {
    console.error(error);
    return null;
  });
  if (!list && response) response.status = 503;
  state.set(key, list);
  return list;
};
