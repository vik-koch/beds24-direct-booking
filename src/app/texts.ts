import type { Location } from '@angular/common';
import { InjectionToken } from '@angular/core';
import type { Language, Texts } from '../content/schema';

// Provided on a language's routes: the texts and the address parts of the page's language.
export const TEXTS = new InjectionToken<Texts>('texts');
export const LANGUAGE = new InjectionToken<Language>('language');

// A page of the application, or a content page by its key.
export type Page = 'home' | 'apartment' | 'notFound' | 'book' | 'confirmation' | 'credits' | string;

export function address(language: Language, page: Page, slug?: string): string {
  const paths = language.paths;
  const apartment = `/${paths.apartments}/${slug}`;
  const rest =
    page === 'home' || page === 'notFound'
      ? ''
      : page === 'apartment'
        ? apartment
        : page === 'book'
          ? `${apartment}/${paths.book}`
          : `/${paths[page]}`;
  return `/${language.code}${rest}`;
}

// Changes the address's query in place, keeping its fragment and the history entry's state.
// Links to the pages a list in site.json names, such as the header's or the footer's.
export const pageLinks = (texts: Texts, language: Language, pages: Page[]) =>
  pages.map((page) => ({ text: texts.pages[page], path: address(language, page) }));

export function replaceQuery(location: Location, change: (params: URLSearchParams) => void) {
  const [rest, hash] = location.path(true).split('#');
  const [path, query = ''] = rest.split('?');
  const params = new URLSearchParams(query);
  const before = params.toString();
  change(params);
  if (params.toString() === before) return;
  const fragment = hash === undefined ? '' : `#${hash}`;
  location.replaceState(
    `${path}${params.size ? `?${params}` : ''}${fragment}`,
    '',
    location.getState(),
  );
}

export const addDays = (date: string, days: number) =>
  new Date(Date.parse(date) + days * 864e5).toISOString().slice(0, 10);

// A day of the calendar as YYYY-MM-DD: not 2027-02-00, which Date.parse turns into NaN, nor
// 2027-02-30, which some engines roll over into March.
export const isDay = (text: string) =>
  /^\d{4}-\d\d-\d\d$/.test(text) && !Number.isNaN(Date.parse(text)) && addDays(text, 0) === text;

// Puts values into a text's {placeholders}.
export const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

// A week from its first day to its last, which may break only after the dash. Not formatRange:
// across the turn of the year it adds both years.
export const formatStay = (
  dates: Intl.DateTimeFormat,
  { arrival, departure }: { arrival: string; departure: string },
) =>
  [arrival, departure]
    .map((day) => dates.format(new Date(day)).replaceAll(' ', '\u00a0'))
    .join('\u00a0– ');

// Whole amounts without cents, as the prices are; any other amount with both digits.
export function formatMoney(tag: string, currency: string, amount: number) {
  const digits = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat(tag, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}
