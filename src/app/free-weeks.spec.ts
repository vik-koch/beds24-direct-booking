import { makeStateKey, RESPONSE_INIT, TransferState, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { FREE_WEEKS, weeks } from './free-weeks';

describe('weeks', () => {
  const response: ResponseInit = {};
  const home = { params: {} } as ActivatedRouteSnapshot;
  const resolve = (providers: Provider[], route = home) => {
    TestBed.configureTestingModule({ providers });
    return TestBed.runInInjectionContext(() => weeks(route, {} as RouterStateSnapshot));
  };
  const onServer = (load: (slug?: string) => Promise<unknown>) => [
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

  it("loads an apartment page's weeks by its slug, kept apart from the home page's", async () => {
    const load = vi.fn(() => Promise.resolve(list));
    const page = { params: { slug: 'zirbe' } } as unknown as ActivatedRouteSnapshot;
    await resolve(onServer(load), page);
    expect(load).toHaveBeenCalledWith('zirbe');
    const state = TestBed.inject(TransferState);
    expect(state.get(makeStateKey<unknown>('free weeks zirbe'), null)).toEqual(list);
    expect(state.hasKey(makeStateKey<unknown>('free weeks '))).toBe(false);
  });

  it('reads in the browser what the server resolved', async () => {
    TestBed.inject(TransferState).set(makeStateKey<unknown>('free weeks '), list);
    const browser = () => weeks(home, {} as RouterStateSnapshot);
    expect(await TestBed.runInInjectionContext(browser)).toEqual(list);
  });
});
