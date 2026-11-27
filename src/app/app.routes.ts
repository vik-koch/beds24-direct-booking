import { DOCUMENT } from '@angular/common';
import { inject, REQUEST_CONTEXT } from '@angular/core';
import { ActivatedRouteSnapshot, Route, Routes, UrlSegment } from '@angular/router';
import { loadPage } from '../content/generated/pages';
import site from '../content/generated/site';
import { loadTexts } from '../content/generated/texts';
import type { Language } from '../content/schema';
import { Credits } from './credits';
import { weeks } from './free-weeks';
import { Home } from './home';
import { listing } from './listing';
import { NotFound } from './not-found';
import { Placeholder } from './placeholder';
import { questions } from './questions';
import { Shell } from './shell';
import { TextPage } from './text-page';
import { LANGUAGE, TEXTS } from './texts';

const apartmentPages = [...new Set(site.apartments.flatMap(({ pages = [] }) => pages))];

const pages = ({ code, paths }: Language): Routes => [
  { path: '', component: Home, resolve: { weeks }, data: { page: 'home' } },
  ...apartmentPages.map((page) => ({
    path: `${paths.apartments}/:slug/${paths[page]}`,
    canMatch: [
      (_route: Route, segments: UrlSegment[]) =>
        site.apartments.some(
          ({ slug, pages }) => slug === segments[1].path && pages?.includes(page),
        ),
    ],
    component: TextPage,
    resolve: {
      content: (route: ActivatedRouteSnapshot) =>
        loadPage[code][`${route.params['slug']}/${page}`](),
    },
    data: { page },
  })),
  {
    path: `${paths.apartments}/:slug`,
    canMatch: [(_route, segments) => site.apartments.some(({ slug }) => slug === segments[1].path)],
    children: [
      {
        path: '',
        // Its own bundle: the other pages do not load the apartment's code.
        loadComponent: () => import('./apartment').then((m) => m.Apartment),
        resolve: { listing, weeks },
        data: { page: 'apartment' },
      },
      {
        path: paths.book,
        loadComponent: () => import('./book').then((m) => m.Book),
        resolve: { weeks, questions },
        data: { page: 'book' },
      },
    ],
  },
  { path: paths.confirmation, component: Placeholder, data: { page: 'confirmation' } },
  { path: paths.credits, component: Credits, data: { page: 'credits' } },
  ...site.pages.map((page) => ({
    path: paths[page],
    component: TextPage,
    resolve: { content: () => loadPage[code][page]() },
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
