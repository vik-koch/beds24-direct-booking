import { RenderMode, ServerRoute } from '@angular/ssr';
import site from '../content/generated/site';

// Pages with listings are rendered per request, the others once at build time.
export const serverRoutes: ServerRoute[] = [
  ...site.languages.flatMap(({ code, paths }) =>
    ['confirmation', 'credits', ...site.pages].map((page) => ({
      path: `${code}/${paths[page]}`,
      renderMode: RenderMode.Prerender as const,
    })),
  ),
  // An apartment page renders the booking panel's view that the visitor's cookie names.
  ...site.languages.map(({ code, paths }) => ({
    path: `${code}/${paths.apartments}/*`,
    renderMode: RenderMode.Server as const,
    headers: { Vary: 'Cookie' },
  })),
  { path: '**', renderMode: RenderMode.Server },
];
