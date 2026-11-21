import { TestBed } from '@angular/core/testing';
import site from '../content/generated/site';
import texts from '../content/generated/texts.en';
import { FreeWeeksList } from './free-weeks-list';
import { LANGUAGE, TEXTS } from './texts';

describe('FreeWeeksList', () => {
  it('names a site’s single season without a year when no week is free', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: TEXTS, useValue: texts },
        { provide: LANGUAGE, useValue: site.languages.find(({ code }) => code === 'en') },
      ],
    });
    const fixture = TestBed.createComponent(FreeWeeksList);
    fixture.componentRef.setInput('weeks', {
      apartments: [{ slug: 'one', name: 'One', guests: 2, size: 30 }],
      capacities: { one: { maxPeople: 2, maxAdults: 2, maxChildren: 0 } },
      currency: 'EUR',
      tax: null,
      seasons: [{ name: 'summer', years: null, state: 'full', weeks: [] }],
    });
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.weeks-empty')?.textContent?.trim()).toBe(
      'No week of Summer is free any more.',
    );
    expect(element.querySelector('h2')?.textContent?.trim()).toBe('Free weeks');
  });
});
