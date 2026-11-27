import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { cached } from '../beds24/cache';
import { addDays, listingOf, loadInventory, questionsOf } from '../beds24/client';
import { freeWeeks, type Period } from '../beds24/weeks';
import site from '../content/generated/site';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { FREE_WEEKS } from './free-weeks';
import { LISTING } from './listing';
import { QUESTIONS } from './questions';
import { dayOf, seasonState, starts } from './season';

const minute = 60_000;
const languages = site.languages.map(({ code }) => code);
// Two calls cost about 3 of Beds24's 100 credits per 5 minutes. The last good answer is
// served for a day while Beds24 cannot be reached, which is asked again a minute after a
// failure at the soonest.
const inventory = cached(
  () => {
    const today = dayOf(new Date());
    // A year of arrivals, and the week after the last one.
    return loadInventory(today, addDays(today, 372), languages);
  },
  2 * minute,
  24 * 60 * minute,
  minute,
);

// The two dated seasons, or a year from today for a site with a single season.
const periods = (now: Date): Period[] => {
  const { season, shown } = seasonState(starts, '', null, now);
  const today = dayOf(now);
  return shown.length
    ? shown.map(({ name, years, start, end }) => ({ name, years, start, end }))
    : [{ name: season, years: null, start: today, end: addDays(today, 364) }];
};

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      provide: FREE_WEEKS,
      useValue: async (slug?: string) => {
        const now = new Date();
        return freeWeeks(
          await inventory(),
          site.apartments,
          periods(now),
          dayOf(now),
          languages,
          slug,
        );
      },
    },
    {
      provide: LISTING,
      useValue: async (roomId: number) => listingOf((await inventory()).rooms, roomId, languages),
    },
    {
      provide: QUESTIONS,
      useValue: async (roomId: number) => questionsOf((await inventory()).rooms, roomId),
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
