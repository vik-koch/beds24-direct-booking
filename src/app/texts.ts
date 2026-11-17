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
export const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
