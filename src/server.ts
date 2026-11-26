import { createHash, timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { address, fallback, indexed } from './app/texts';
import site from './content/generated/site';

const app = express();
const angularApp = new AngularNodeAppEngine();

// A site under test answers only with its password, under any user name, and no shared cache
// may keep what it answers.
const password = process.env['SITE_PASSWORD'];
if (password) {
  const digest = (text: string) => createHash('sha256').update(text).digest();
  app.use((req, res, next) => {
    const [scheme, encoded = ''] = req.headers.authorization?.split(' ') ?? [];
    const given = /:(.*)/s.exec(Buffer.from(encoded, 'base64').toString())?.[1] ?? '';
    res.set('Cache-Control', 'private, no-store');
    if (scheme === 'Basic' && timingSafeEqual(digest(given), digest(password))) return next();
    res.set('WWW-Authenticate', 'Basic realm="site", charset="UTF-8"').status(401).end();
  });
}

const languages = site.languages.map(({ code }) => code);
// With the address's query, which may carry the visitor's guests.
app.get('/', (req, res) => {
  const language = req.acceptsLanguages(languages) || languages[0];
  res.vary('Accept-Language').redirect(`/${language}${req.originalUrl.slice(1)}`);
});

// The header X-Robots-Tag keeps search engines out of a deployment that is not INDEXED;
// robots.txt never does, or they would not read that header.
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);
});
// Every indexed page in every language, each with its alternates.
app.get('/sitemap.xml', (_req, res) => {
  const pages: [string, string?][] = [
    ...['home', 'credits', ...site.pages].map((page): [string] => [page]),
    ...site.apartments.flatMap(({ slug, pages = [] }) =>
      ['apartment', ...pages].map((page): [string, string] => [page, slug]),
    ),
  ].filter(([page, slug]) => indexed(page, slug));
  const urls = pages.flatMap(([page, slug]) => {
    const alternates = [
      ...site.languages.map((language) => [language.tag, site.url + address(language, page, slug)]),
      ['x-default', site.url + fallback(page, slug)],
    ]
      .map(([tag, href]) => `<xhtml:link rel="alternate" hreflang="${tag}" href="${href}"/>`)
      .join('');
    return site.languages.map(
      (language) =>
        `<url><loc>${site.url + address(language, page, slug)}</loc>${alternates}</url>`,
    );
  });
  res
    .type('application/xml')
    .send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`,
    );
});

app.use(
  express.static(join(import.meta.dirname, '../browser'), {
    maxAge: '1y',
    cacheControl: !password,
    index: false,
    redirect: false,
  }),
);

app.use((req, res, next) => {
  angularApp
    .handle(req, { language: req.acceptsLanguages(languages) || languages[0] })
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
}

// The Angular CLI's dev server and build import this handler.
export const reqHandler = createNodeRequestHandler(app);
