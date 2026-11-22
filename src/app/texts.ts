import type { Location } from '@angular/common';
import { InjectionToken } from '@angular/core';
import type { Language, Texts } from '../content/schema';

// Provided on a language's routes: the texts and the address parts of the page's language.
export const TEXTS = new InjectionToken<Texts>('texts');
export const LANGUAGE = new InjectionToken<Language>('language');

export type Page =
  'home' | 'apartment' | 'notFound' | Exclude<keyof Language['paths'], 'apartments'>;

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

// Puts values into a text's {placeholders}.
// Changes the address's query in place, keeping its fragment and the history entry's state.
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
