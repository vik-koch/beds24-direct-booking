import { Location } from '@angular/common';
import { provideLocationMocks, SpyLocation } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { Guests } from './guests';

const at = (url: string) => {
  TestBed.configureTestingModule({ providers: [provideLocationMocks()] });
  (TestBed.inject(Location) as SpyLocation).go(url);
  return TestBed.inject(Guests);
};
const twin = { maxPeople: 2, maxAdults: 2, maxChildren: 0 };
const family = { maxPeople: 6, maxAdults: 4, maxChildren: 4 };

describe('Guests', () => {
  it('puts the choice into an address of the site, beside its query, and no other', () => {
    const guests = at('/de?adults=3&children=1');
    expect(guests.link('/de/faq?x=1#top')).toBe('/de/faq?x=1&adults=3&children=1#top');
    expect(guests.link('https://example.com/a')).toBe('https://example.com/a');
    expect(guests.link('//example.com/a')).toBe('//example.com/a');
  });

  it('replaces the guests an address of the site carries', () => {
    expect(at('/de?adults=3').link('/de?children=2')).toBe('/de?adults=3');
  });

  it('counts children as guests where no room asks for them', () => {
    const guests = at('/de?adults=1&children=1');
    guests.limit([twin]);
    expect([guests.adults(), guests.children()]).toEqual([2, 0]);
  });

  it('takes the choice of an address that Back restores', () => {
    const guests = at('/de?adults=3');
    guests.limit([family]);
    (TestBed.inject(Location) as SpyLocation).simulateUrlPop('/de?adults=1&children=4');
    expect([guests.adults(), guests.children()]).toEqual([1, 4]);
  });
});
