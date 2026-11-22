import { createHash, timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
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

app.use(
  express.static(join(import.meta.dirname, '../browser'), {
    maxAge: '1y',
    cacheControl: !password,
    index: false,
    redirect: false,
  }),
);

// An apartment page renders the booking panel's view that the visitor's cookie names.
app.use((req, res, next) => {
  res.vary('Cookie');
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
