import { Location } from '@angular/common';
import { provideLocationMocks, SpyLocation } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { Choice } from './choice';
import { Season } from './season';

const at = (url: string) => {
  TestBed.configureTestingModule({ providers: [provideLocationMocks()] });
  (TestBed.inject(Location) as SpyLocation).go(url);
  return TestBed.inject(Choice);
};
const twin = { maxPeople: 2, asksChildren: false };
const family = { maxPeople: 6, asksChildren: true };

describe('Choice', () => {
  it('puts the choice into an address of the site, beside its query, and no other', () => {
    const choice = at('/de?adults=3&children=1');
    expect(choice.link('/de/faq?x=1#top')).toBe('/de/faq?x=1&adults=3&children=1#top');
    expect(choice.link('https://example.com/a')).toBe('https://example.com/a');
    expect(choice.link('//example.com/a')).toBe('//example.com/a');
  });

  it('keeps the address as written in a fragment of this page', () => {
    const choice = at('/de?apartment=a&arrival=2027-01-02&adults=3');
    expect(choice.link('/de#weeks')).toBe('/de?apartment=a&arrival=2027-01-02&adults=3#weeks');
    expect(choice.link('/de/a#x')).toBe('/de/a?adults=3#x');
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
    const choice = at('/de?adults=1&children=1');
    choice.limit([twin]);
    expect([choice.adults(), choice.children()]).toEqual([2, 0]);
  });

  it('takes the choice of an address that Back restores', () => {
    const choice = at('/de?adults=3');
    choice.limit([family]);
    (TestBed.inject(Location) as SpyLocation).simulateUrlPop('/de?adults=1&children=4');
    expect([choice.adults(), choice.children()]).toEqual([1, 4]);
  });

  it('takes the view from its cookie, and carries it in no address', () => {
    document.cookie = 'view=calendar; Path=/';
    const choice = at('/de?view=list');
    expect(choice.view()).toBe('calendar');
    expect(choice.link('/de/a')).toBe('/de/a');
    choice.show('list');
    expect(document.cookie).not.toContain('view=');
  });

  it('carries a week to its home and its page, with a season only once switched away', () => {
    const choice = at('/de/a');
    const season = TestBed.inject(Season);
    season.current.set('winter');
    const week = { home: '/de', page: '/de/a', slug: 'a', arrival: '2027-01-02' };
    choice.week.set(week);
    expect(choice.link('/de#weeks')).toBe('/de?apartment=a&arrival=2027-01-02#weeks');
    expect(choice.link('/de/a')).toBe('/de/a?arrival=2027-01-02');
    expect(choice.link('/de/b')).toBe('/de/b');
    season.current.set('summer');
    expect(choice.link('/de/a')).toBe('/de/a?arrival=2027-01-02&season=summer');
  });
});
