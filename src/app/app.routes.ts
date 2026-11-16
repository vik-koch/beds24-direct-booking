import { Routes } from '@angular/router';
import site from '../content/generated/site';
import { loadTexts } from '../content/generated/texts';
import type { Language } from '../content/schema';
import { apartments } from './apartments';
import { Credits } from './credits';
import { Home } from './home';
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
  { path: '', component: Home, resolve: { apartments }, data: { page: 'home' } },
  {
    path: `${paths.apartments}/:slug`,
    canMatch: [(_route, segments) => site.apartments.some(({ slug }) => slug === segments[1].path)],
    children: [
      { path: '', component: Placeholder, data: { page: 'apartment' } },
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

export const routes: Routes = site.languages.map((language) => ({
  path: language.code,
  loadChildren: async () => {
    const texts = await loadTexts[language.code]();
    return [
      {
        path: '',
        component: Shell,
        providers: [
          { provide: TEXTS, useValue: texts },
          { provide: LANGUAGE, useValue: language },
        ],
        children: pages(language),
      },
    ];
  },
}));
