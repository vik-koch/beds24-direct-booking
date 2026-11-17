import { makeStateKey, RESPONSE_INIT, TransferState, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { FREE_WEEKS, weeks } from './free-weeks';

describe('weeks', () => {
  const response: ResponseInit = {};
  const resolve = (providers: Provider[]) => {
    TestBed.configureTestingModule({ providers });
    return TestBed.runInInjectionContext(() =>
      weeks({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  };
  const onServer = (load: () => Promise<unknown>) => [
    { provide: FREE_WEEKS, useValue: load },
    { provide: RESPONSE_INIT, useValue: response },
  ];
  const list = { apartments: [], currency: 'EUR', tax: null, seasons: [] };
  beforeEach(() => delete response.status);

  it('answers 503 without a list when Beds24 fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await resolve(onServer(() => Promise.reject(new Error('down'))))).toBeNull();
    expect(response.status).toBe(503);
  });

  it('passes the list on with the status untouched', async () => {
    expect(await resolve(onServer(() => Promise.resolve(list)))).toEqual(list);
    expect(response.status).toBeUndefined();
  });

  it('reads in the browser what the server resolved', async () => {
    TestBed.inject(TransferState).set(makeStateKey<unknown>('free weeks'), list);
    const browser = () => weeks({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot);
    expect(await TestBed.runInInjectionContext(browser)).toEqual(list);
  });
});
