import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { Listing } from '../beds24/client';
import type { FreeWeeks } from '../beds24/weeks';
import site from '../content/generated/site';
import { Choice, fits, seasonOf } from './choice';
import { heading } from './shell';
import { addDays, address, fill, formatStay, isDay, LANGUAGE, TEXTS } from './texts';

// The booking step until online booking opens: the stay from the address, checked against the
// apartment's weeks and limits, and an e-mail that asks for it. While Beds24 cannot be reached
// the stay goes unchecked: the host confirms it in the reply.
@Component({
  selector: 'app-book',
  template: `
    <div class="column pt-(--space-section)">
      <h1 class="headline">{{ heading }}</h1>
      @if (problem) {
        <p class="text-ink-soft mt-6">{{ problem }}</p>
        <p class="mt-6">
          <a class="button" [href]="back">{{ fill(texts.book.back, { apartment: name }) }}</a>
        </p>
      } @else {
        <dl class="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt class="text-ink-soft">{{ texts.weeks.apartment }}</dt>
          <dd>{{ name }}</dd>
          <dt class="text-ink-soft">{{ texts.weeks.week }}</dt>
          <dd>{{ week }}</dd>
          <dt class="text-ink-soft">{{ texts.panel.guests }}</dt>
          <dd>{{ guests }}</dd>
        </dl>
        <p class="mt-6">{{ texts.book.text }}</p>
        @if (mail) {
          <p class="mt-6">
            <a class="button" [href]="mail">{{ texts.book.mail }}</a>
          </p>
        }
      }
    </div>
  `,
})
export class Book {
  protected readonly texts = inject(TEXTS);
  protected readonly fill = fill;
  private readonly language = inject(LANGUAGE);
  private readonly choice = inject(Choice);
  private readonly route = inject(ActivatedRoute).snapshot;
  protected readonly heading = heading(this.texts, this.route);
  private readonly slug: string = this.route.params['slug'];
  protected readonly name = site.apartments.find(({ slug }) => slug === this.slug)!.name;

  private readonly plural = new Intl.PluralRules(this.language.tag);
  // A count and its noun stay on one line.
  private readonly count = (forms: { one: string; other: string }, count: number) =>
    fill(this.plural.select(count) === 'one' ? forms.one : forms.other, { count }).replaceAll(
      ' ',
      '\u00a0',
    );

  private readonly arrival = this.route.queryParamMap.get('arrival') ?? '';
  protected readonly week: string;
  protected readonly guests: string;
  protected readonly problem: string | null;
  protected readonly back: string;
  protected readonly mail: string | null;

  constructor() {
    const weeks: FreeWeeks | null = this.route.data['weeks'];
    const limits: Listing | null = this.route.data['listing'];
    const [adults, children] = [this.choice.adults(), this.choice.children()];
    // Where the apartment asks for no children, they are guests like the adults.
    this.guests =
      limits && !limits.asksChildren
        ? this.count(this.texts.weeks.guests, adults + children)
        : new Intl.ListFormat(this.language.tag).format([
            this.count(this.texts.panel.adults, adults),
            ...(children ? [this.count(this.texts.book.children, children)] : []),
          ]);
    const season = weeks && seasonOf(weeks, this.arrival);
    const valid = weeks ? !!season : isDay(this.arrival);
    const free =
      !weeks ||
      !!season?.weeks.some(({ arrival, prices }) => arrival === this.arrival && prices[0] !== null);
    const dates = new Intl.DateTimeFormat(this.language.tag, {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    this.week = valid
      ? formatStay(dates, { arrival: this.arrival, departure: addDays(this.arrival, 7) })
      : '';
    this.problem = !valid
      ? this.texts.book.invalid
      : !free
        ? this.texts.book.taken
        : limits && !fits(limits, adults, children)
          ? fill(this.texts.panel.small, {
              name: this.name,
              guests: this.count(this.texts.weeks.guests, limits.maxPeople),
            })
          : null;
    // The apartment's panel shows the week chosen, as blocked where it is no longer free.
    const page = address(this.language, 'apartment', this.slug);
    this.back = this.choice.link(`${page}${valid ? `?arrival=${this.arrival}` : ''}#booking`);
    const email = site.contact?.email;
    const values = { apartment: this.name, week: this.week, guests: this.guests };
    // Encoded by hand: URLSearchParams writes a space as "+", which a mail program keeps.
    this.mail = email
      ? `mailto:${email}?subject=${encodeURIComponent(fill(this.texts.book.subject, values))}` +
        `&body=${encodeURIComponent(fill(this.texts.book.body, values))}`
      : null;
  }
}
