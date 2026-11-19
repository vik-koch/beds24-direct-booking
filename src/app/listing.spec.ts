import { makeStateKey, RESPONSE_INIT, TransferState, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import site from '../content/generated/site';
import { listing, LISTING } from './listing';

describe('listing', () => {
  const response: ResponseInit = {};
  const { slug, roomId } = site.apartments[0];
  const route = { params: { slug } } as unknown as ActivatedRouteSnapshot;
  const resolve = (providers: Provider[]) => {
    TestBed.configureTestingModule({ providers });
    return TestBed.runInInjectionContext(() => listing(route, {} as RouterStateSnapshot));
  };
  const onServer = (load: (id: number) => Promise<unknown>) => [
    { provide: LISTING, useValue: load },
    { provide: RESPONSE_INIT, useValue: response },
  ];
  const value = {
    maxPeople: 2,
    size: 34,
    address: '',
    checkIn: { from: null, until: null },
    checkOut: null,
    features: [],
    texts: {},
  };
  beforeEach(() => delete response.status);

  it('answers 503 without a listing when Beds24 fails or lacks the room', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await resolve(onServer(() => Promise.reject(new Error('no room'))))).toBeNull();
    expect(response.status).toBe(503);
    expect(console.error).toHaveBeenCalled();
  });

  it("loads the apartment's room and passes it on with the status untouched", async () => {
    const load = vi.fn(() => Promise.resolve(value));
    expect(await resolve(onServer(load))).toEqual(value);
    expect(load).toHaveBeenCalledWith(roomId);
    expect(response.status).toBeUndefined();
  });

  it('reads in the browser what the server resolved', async () => {
    TestBed.inject(TransferState).set(makeStateKey<unknown>(`listing ${slug}`), value);
    const browser = () => listing(route, {} as RouterStateSnapshot);
    expect(await TestBed.runInInjectionContext(browser)).toEqual(value);
  });
});
