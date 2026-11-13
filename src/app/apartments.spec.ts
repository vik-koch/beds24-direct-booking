import { makeStateKey, RESPONSE_INIT, TransferState, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { APARTMENTS, apartments } from './apartments';

describe('apartments', () => {
  const response: ResponseInit = {};
  const resolve = (providers: Provider[]) => {
    TestBed.configureTestingModule({ providers });
    return TestBed.runInInjectionContext(() =>
      apartments({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  };
  const onServer = (load: () => Promise<unknown>) => [
    { provide: APARTMENTS, useValue: load },
    { provide: RESPONSE_INIT, useValue: response },
  ];
  beforeEach(() => delete response.status);

  it('answers 503 without a list when Beds24 fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await resolve(onServer(() => Promise.reject(new Error('down'))))).toBeNull();
    expect(response.status).toBe(503);
  });

  it('passes an empty list on with the status untouched', async () => {
    expect(await resolve(onServer(() => Promise.resolve([])))).toEqual([]);
    expect(response.status).toBeUndefined();
  });

  it('reads in the browser what the server resolved', async () => {
    const list = [{ id: 11, propertyId: 1, name: 'One' }];
    TestBed.inject(TransferState).set(makeStateKey<unknown>('apartments'), list);
    const browser = () => apartments({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot);
    expect(await TestBed.runInInjectionContext(browser)).toEqual(list);
  });
});
