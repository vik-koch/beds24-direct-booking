import { RenderMode, ServerRoute } from '@angular/ssr';
import site from '../content/generated/site';
import { simplePages } from './app.routes';

// Pages with listings are rendered per request, the others once at build time.
export const serverRoutes: ServerRoute[] = [
  ...site.languages.flatMap(({ code, paths }) =>
    simplePages.map((page) => ({
      path: `${code}/${paths[page]}`,
      renderMode: RenderMode.Prerender as const,
    })),
  ),
  { path: '**', renderMode: RenderMode.Server },
];
