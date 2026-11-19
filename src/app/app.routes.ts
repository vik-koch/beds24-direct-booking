import { DOCUMENT } from '@angular/common';
import { inject, REQUEST_CONTEXT } from '@angular/core';
import { Routes } from '@angular/router';
import site from '../content/generated/site';
import { loadTexts } from '../content/generated/texts';
import type { Language } from '../content/schema';
import { Apartment } from './apartment';
import { Credits } from './credits';
import { weeks } from './free-weeks';
import { Home } from './home';
import { listing } from './listing';
import { NotFound } from './not-found';
import { Placeholder } from './placeholder';
import { Shell } from './shell';
import { LANGUAGE, TEXTS } from './texts';

export const simplePages = [
  'confirmation',
  'faq',
  'about',
  'imprint',
  'privacy',
  'terms',
  'credits',
] as const;

const pages = ({ paths }: Language): Routes => [
  { path: '', component: Home, resolve: { weeks }, data: { page: 'home' } },
  {
    path: `${paths.apartments}/:slug`,
    canMatch: [(_route, segments) => site.apartments.some(({ slug }) => slug === segments[1].path)],
    children: [
      { path: '', component: Apartment, resolve: { listing }, data: { page: 'apartment' } },
      { path: paths.book, component: Placeholder, data: { page: 'book' } },
    ],
  },
  ...simplePages.map((page) => ({
    path: paths[page],
    component: page === 'credits' ? Credits : Placeholder,
    data: { page },
  })),
  { path: '**', component: NotFound, data: { page: 'notFound' } },
];

const shell = (language: Language, children: Routes) => async (): Promise<Routes> => [
  {
    path: '',
    component: Shell,
    providers: [
      { provide: TEXTS, useValue: await loadTexts[language.code]() },
      { provide: LANGUAGE, useValue: language },
    ],
    children,
  },
];

// Outside every language's prefix: the language the server chose from the browser's, and in
// the browser the one the server rendered.
const preferred = (): string =>
  (inject(REQUEST_CONTEXT, { optional: true }) as { language?: string } | null)?.language ??
  site.languages.find(({ tag }) => tag === inject(DOCUMENT).documentElement.lang)?.code ??
  site.languages[0].code;

export const routes: Routes = [
  ...site.languages.map((language) => ({
    path: language.code,
    loadChildren: shell(language, pages(language)),
  })),
  ...site.languages.map((language) => ({
    path: '**',
    canMatch: [() => preferred() === language.code],
    loadChildren: shell(language, [{ path: '', component: NotFound, data: { page: 'notFound' } }]),
  })),
];
