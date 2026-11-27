import { inject, InjectionToken } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { FreeWeeks } from '../beds24/weeks';
import { fromServer } from './from-server';

// Provided on the server only, so the Beds24 client stays out of the browser bundle. With a
// slug, the weeks of that apartment alone, for its page's booking panel.
export const FREE_WEEKS = new InjectionToken<(slug?: string) => Promise<FreeWeeks>>('free weeks');

export const weeks: ResolveFn<FreeWeeks | null> = (route) => {
  const slug: string | undefined = route.params['slug'];
  const load = inject(FREE_WEEKS, { optional: true });
  return fromServer(`free weeks ${slug ?? ''}`, load && (() => load(slug)));
};
