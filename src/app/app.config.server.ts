import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { listApartments } from '../beds24/client';
import { APARTMENTS } from './apartments';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: APARTMENTS, useValue: listApartments },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
