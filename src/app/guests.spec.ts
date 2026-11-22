import { Location } from '@angular/common';
import { provideLocationMocks, SpyLocation } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { Guests } from './guests';
import { Season } from './season';

const at = (url: string) => {
  TestBed.configureTestingModule({ providers: [provideLocationMocks()] });
  (TestBed.inject(Location) as SpyLocation).go(url);
  return TestBed.inject(Guests);
};
const twin = { maxPeople: 2, asksChildren: false };
const family = { maxPeople: 6, asksChildren: true };

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

  it('keeps the rest of an address of the site, a second ? or # included', () => {
    expect(at('/de?adults=3').link('/de/faq?topic=a?b&children=2#x#y')).toBe(
      '/de/faq?topic=a%3Fb&adults=3#x#y',
    );
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

  it('carries the view of its address, also after Back', () => {
    const guests = at('/de?view=calendar');
    expect(guests.link('/de/a')).toBe('/de/a?view=calendar');
    (TestBed.inject(Location) as SpyLocation).simulateUrlPop('/de');
    expect(guests.link('/de/a')).toBe('/de/a');
  });

  it('carries a week to its home and its page, with its season only while that is shown', () => {
    const guests = at('/de/a');
    TestBed.inject(Season).current.set('winter');
    const week = { home: '/de', page: '/de/a', slug: 'a', arrival: '2027-01-02' };
    guests.week.set({ ...week, departure: '2027-01-09', season: 'winter' });
    expect(guests.link('/de#weeks')).toBe('/de?apartment=a&arrival=2027-01-02&season=winter#weeks');
    expect(guests.link('/de/b')).toBe('/de/b');
    guests.week.set({ ...week, departure: '2027-01-09', season: 'summer' });
    expect(guests.link('/de/a')).toBe('/de/a?arrival=2027-01-02&departure=2027-01-09');
  });
});
