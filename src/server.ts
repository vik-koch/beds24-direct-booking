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

const languages = site.languages.map(({ code }) => code);
app.get('/', (req, res) => {
  res.vary('Accept-Language').redirect(`/${req.acceptsLanguages(languages) || languages[0]}`);
});

app.use(
  express.static(join(import.meta.dirname, '../browser'), {
    maxAge: '1y',
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
