import { inject, InjectionToken } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { Question } from '../beds24/questions';
import site from '../content/generated/site';
import { fromServer } from './from-server';

// Provided on the server only, so the Beds24 client stays out of the browser bundle. Null where
// the apartment takes no booking on the site.
export const QUESTIONS = new InjectionToken<(roomId: number) => Promise<Question[] | null>>(
  'questions',
);

// The booking form's questions, with their texts in every language.
export const questions: ResolveFn<Question[] | null> = (route) => {
  const slug: string = route.params['slug'];
  const load = inject(QUESTIONS, { optional: true });
  const { roomId } = site.apartments.find((apartment) => apartment.slug === slug)!;
  return fromServer(`questions ${slug}`, load && (() => load(roomId)));
};
