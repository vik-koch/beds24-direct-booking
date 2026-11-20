import { Location } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideCalendar,
  lucideChevronLeft,
  lucideChevronRight,
  lucideList,
} from '@ng-icons/lucide';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import type { Listing } from '../beds24/client';
import type { FreeWeeks } from '../beds24/weeks';
import site from '../content/generated/site';
import type { SeasonName } from '../content/names';
import { BookingBar, type BarLine } from './booking-bar';
import { Season } from './season';
import { swapper } from './swap';
import { address, fill, LANGUAGE, TEXTS } from './texts';

type SeasonWeeks = FreeWeeks['seasons'][number];
interface Stay {
  arrival: string;
  departure: string;
  price: number | null;
}
// A day of a month's calendar; a free week's first day starts it. Blank before the first.
interface Day {
  date: string;
  day: number | null;
  start?: Stay;
  booked: boolean;
}
interface Month {
  key: string;
  name: string;
  stays: Stay[];
  days: Day[];
}

const day = 864e5;
const addDays = (date: string, days: number) =>
  new Date(Date.parse(date) + days * day).toISOString().slice(0, 10);

// The apartment page's booking panel: a week of the shown season, one month at a time as a list
// or a calendar, the guests within Beds24's limits, the total and the way on to booking. As in
// the free-weeks list, both seasons are in the page and the page's season attribute shows one.
// The choice lives in the address, so a reload or a shared link keeps it.
@Component({
  encapsulation: ViewEncapsulation.None,
  selector: 'app-booking-panel',
  imports: [NgIcon, HlmSelectImports, BookingBar],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideArrowRight,
      lucideCalendar,
      lucideChevronLeft,
      lucideChevronRight,
      lucideList,
    }),
  ],
  template: `
    <section id="booking" class="panel" aria-labelledby="booking-title">
      <h2 id="booking-title" tabindex="-1">
        {{ texts.panel.title }}
        @if (weeks?.seasons?.[0]?.years) {
          <span class="weeks-season stack">
            @for (season of weeks!.seasons; track season.name) {
              <span [attr.data-for]="season.name">{{ dated(season) }}</span>
            }
          </span>
        }
      </h2>
      @if (weeks && limits) {
        <div class="panel-bar">
          @if (weeks.seasons.length === 2) {
            <button type="button" class="other-season stack" (click)="slide()">
              @for (season of weeks.seasons; track season.name) {
                <span [attr.data-for]="season.name">
                  @if ($first) {
                    {{ dated(other(season.name)) }}
                    <ng-icon name="lucideArrowRight" aria-hidden="true" />
                  } @else {
                    <ng-icon name="lucideArrowLeft" aria-hidden="true" />
                    {{ dated(other(season.name)) }}
                  }
                </span>
              }
            </button>
          }
          <div
            class="views"
            role="radiogroup"
            [attr.aria-label]="texts.panel.views.label"
            [attr.data-view]="view()"
          >
            <span class="views-knob" aria-hidden="true"></span>
            @for (name of views; track name) {
              <label [title]="texts.panel.views[name]">
                <input
                  type="radio"
                  name="view"
                  [checked]="view() === name"
                  (change)="show(name)"
                  [attr.aria-label]="texts.panel.views[name]"
                />
                <ng-icon [name]="name === 'list' ? 'lucideList' : 'lucideCalendar'" />
              </label>
            }
          </div>
        </div>
        <p class="sr-only" aria-live="polite">{{ announced() }}</p>
        <div class="panel-seasons">
          @for (season of weeks.seasons; track season.name) {
            <div class="panel-season" [attr.data-for]="season.name">
              @if (season.state === 'open') {
                @let shown = month(season.name);
                @let months = monthsOf(season);
                <div class="month-head">
                  <button
                    type="button"
                    class="icon-button"
                    [attr.aria-label]="texts.panel.previous"
                    [disabled]="shown === 0"
                    (click)="page(season, -1)"
                  >
                    <ng-icon name="lucideChevronLeft" aria-hidden="true" />
                  </button>
                  <h3 [id]="'month-' + season.name">{{ months[shown].name }}</h3>
                  <button
                    type="button"
                    class="icon-button"
                    [attr.aria-label]="texts.panel.next"
                    [disabled]="shown === months.length - 1"
                    (click)="page(season, 1)"
                  >
                    <ng-icon name="lucideChevronRight" aria-hidden="true" />
                  </button>
                </div>
                <div class="months">
                  @for (month of months; track month.key) {
                    <div
                      class="month"
                      role="radiogroup"
                      [attr.aria-labelledby]="'month-' + season.name"
                      [attr.data-month]="$index"
                      [attr.data-current]="$index === shown ? '' : null"
                    >
                      @if (view() === 'list') {
                        <!-- Every week starts on the same weekday, so a row leaves it out; the
                             radio's name says it. -->
                        @for (stay of month.stays; track stay.arrival) {
                          @if (stay.price === null) {
                            <p class="stay booked">
                              <span>{{ stayText(stay, short) }}</span>
                              <span>{{ texts.weeks.taken }}</span>
                            </p>
                          } @else {
                            <label class="stay">
                              <input
                                type="radio"
                                [name]="'week-' + month.key"
                                [checked]="isChosen(season.name, stay)"
                                (change)="choose(season.name, stay)"
                                [attr.aria-label]="
                                  stayText(stay, spoken) + ', ' + money(stay.price)
                                "
                              />
                              <span>{{ stayText(stay, short) }}</span>
                              <span class="price">{{ money(stay.price) }}</span>
                            </label>
                          }
                        }
                      } @else {
                        <div class="calendar">
                          @for (name of weekdays; track $index) {
                            <span class="weekday-name" aria-hidden="true">{{ name }}</span>
                          }
                          @for (cell of month.days; track $index) {
                            @let band = bandOf(season.name, cell.date);
                            <span
                              class="day"
                              [class.in-band]="band.in"
                              [class.band-start]="band.start"
                              [class.band-end]="band.end"
                            >
                              @if (cell.start; as stay) {
                                <label class="start">
                                  <input
                                    type="radio"
                                    [name]="'week-' + month.key"
                                    [checked]="isChosen(season.name, stay)"
                                    (change)="choose(season.name, stay)"
                                    [attr.aria-label]="
                                      stayText(stay, spoken) + ', ' + money(stay.price!)
                                    "
                                  />
                                  <span>{{ cell.day }}</span>
                                </label>
                              } @else if (cell.day) {
                                <span [class.booked]="cell.booked" aria-hidden="true">{{
                                  cell.day
                                }}</span>
                              }
                            </span>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              } @else {
                <p class="panel-empty">
                  {{ fill(texts.weeks[season.state], { season: dated(season) }) }}
                </p>
              }
            </div>
          }
        </div>
        <div class="guests">
          @if (limits.maxChildren) {
            <h3>{{ texts.panel.guests }}</h3>
          }
          <div class="counts">
            <div class="count">
              <label [class.guests-title]="!limits.maxChildren" for="adults">{{
                limits.maxChildren ? texts.panel.adults.label : texts.panel.guests
              }}</label>
              <hlm-select [value]="adults()" (valueChange)="setAdults($event!)">
                <hlm-select-trigger buttonId="adults" [class]="trigger">
                  <hlm-select-value />
                </hlm-select-trigger>
                <hlm-select-content *hlmSelectPortal>
                  @for (n of range(1, limits.maxAdults); track n) {
                    <hlm-select-item [value]="n">{{ n }}</hlm-select-item>
                  }
                </hlm-select-content>
              </hlm-select>
            </div>
            @if (limits.maxChildren) {
              <div class="count">
                <label for="children"
                  >{{ texts.panel.children }}
                  <small>{{ fill(texts.panel.childAge, { age: childAge }) }}</small></label
                >
                <hlm-select [value]="children()" (valueChange)="setChildren($event!)">
                  <hlm-select-trigger buttonId="children" [class]="trigger">
                    <hlm-select-value />
                  </hlm-select-trigger>
                  <hlm-select-content *hlmSelectPortal>
                    @for (n of range(0, roomForChildren()); track n) {
                      <hlm-select-item [value]="n">{{ n }}</hlm-select-item>
                    }
                  </hlm-select-content>
                </hlm-select>
              </div>
            }
          </div>
          <p class="babies">{{ texts.panel.babies }}</p>
        </div>
        <!-- A season with no week to choose has no total and no button. -->
        @for (season of weeks.seasons; track season.name) {
          @if (season.state === 'open') {
            <div class="outcome" [attr.data-for]="season.name">
              @if (pickIn(season.name); as stay) {
                <dl class="total">
                  <div>
                    <dt>{{ fill(texts.panel.week, { stay: stayText(stay) }) }}</dt>
                    <dd>{{ money(stay.price!) }}</dd>
                  </div>
                  @if (taxLine(); as tax) {
                    <div>
                      <dt>{{ tax.text }}</dt>
                      <dd>{{ money(tax.amount) }}</dd>
                    </div>
                  }
                  <div class="sum">
                    <dt>{{ texts.panel.total }}</dt>
                    <dd>{{ money(stay.price! + (taxLine()?.amount ?? 0)) }}</dd>
                  </div>
                </dl>
                <a class="button wide" [href]="bookingLink(stay)"
                  >{{ texts.panel.book }}<ng-icon name="lucideArrowRight" aria-hidden="true"
                /></a>
              } @else {
                @let from = texts.panel.from.split('{price}');
                <p class="from">
                  {{ from[0] }}<strong>{{ money(lowest(season)) }}</strong
                  >{{ from[1] }}
                </p>
                <button type="button" class="button wide" disabled>{{ texts.panel.choose }}</button>
              }
              <p class="panel-note">{{ texts.panel.note }}</p>
            </div>
          }
        }
      } @else {
        <p class="panel-empty">{{ texts.weeks.unavailable }}</p>
      }
    </section>
    @if (weeks && limits) {
      <app-booking-bar [lines]="barLines()" [shown]="barShown()" />
    }
  `,
  styles: `
    @layer components {
      .booking {
        display: block;

        /* Beside the content it stays in view, and one taller than the window scrolls with the
           page until its foot shows (--height, measured). */
        @media (min-width: 64rem) {
          position: sticky;
          top: min(5.5rem, 100dvh - var(--height, 0px) - 1rem);
          align-self: start;
        }
      }

      .panel {
        --inset: 1.25rem;
        padding: 1.5rem var(--inset);
        border-radius: var(--radius-card);
        background: var(--color-surface);
        box-shadow: var(--shadow-card);

        @media (min-width: 48rem) {
          --inset: 2rem;
          padding-block: 2rem;
        }

        /* Sized as the page's other headings. */
        h2 {
          margin: 0;
          line-height: 1.2;
        }

        /* The radios are the labels round them, which draw their rings. */
        input[type='radio'] {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        label:has(:focus-visible) {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .weeks-season {
          display: grid;
        }

        h3 {
          font-size: 1.0625rem;
          font-weight: 500;
        }
      }

      /* The way to the other season and the view's switch share a line. */
      .panel-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem 1rem;
        margin-top: 0.25rem;

        .other-season {
          font-size: 0.9375rem;

          @media (min-width: 48rem) {
            justify-items: start;
          }
        }
      }

      /* Two icons in a pill; the accent part glides to the chosen one, as in the season switch. */
      .views {
        --narrow: var(--size-control-small);
        --pad: calc((var(--size-control) - var(--narrow)) / 2);
        position: relative;
        display: grid;
        grid-template-columns: repeat(2, var(--narrow));
        height: var(--size-control);
        margin-left: auto;
        padding: var(--pad);
        border-radius: var(--radius-control);
        background: var(--color-ground);

        label {
          z-index: 1;
          display: grid;
          place-items: center;
          border-radius: var(--radius-control);
          color: var(--color-ink-soft);
          cursor: pointer;
          transition: color 0.3s ease;
        }

        ng-icon {
          --ng-icon__size: 1.125rem;
        }

        &[data-view='list'] label:first-of-type,
        &[data-view='calendar'] label:last-of-type {
          color: var(--color-on-accent);
        }

        label:has(:focus-visible) {
          outline-offset: 4px;
        }
      }

      .views-knob {
        position: absolute;
        inset-block: var(--pad);
        left: var(--pad);
        width: var(--narrow);
        border-radius: var(--radius-control);
        background: var(--color-accent);
        transition: translate 0.32s cubic-bezier(0.65, 0, 0.35, 1);

        [data-view='calendar'] > & {
          translate: 100% 0;
        }

        @media (prefers-reduced-motion: reduce) {
          transition: none;
        }
      }

      /* The seasons, and in each its months, lie in one place, so one can slide over another;
         the focus rings of the rows at the edges have room inside the clip. */
      .panel-seasons {
        display: grid;
        margin: 0.75rem calc(-1 * var(--inset)) 0;
        padding-inline: var(--inset);
        overflow: clip;
      }

      .panel-season {
        grid-area: 1 / 1;
        align-self: start;
      }

      .month-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-inline: -0.5rem;

        .icon-button {
          font-size: 1.25rem;
          transition: background-color 0.2s;

          &:hover:not(:disabled) {
            background: var(--color-ground);
          }

          &:disabled {
            color: var(--color-line);
            cursor: default;
          }
        }
      }

      /* As tall as the calendar's longest month, in both views, so nothing below moves. */
      .months {
        --day: var(--size-control-small);
        display: grid;
        height: calc(1.75rem + 6 * var(--day) + 5 * 0.25rem + 0.5rem);
        margin-top: 0.25rem;

        > * {
          grid-area: 1 / 1;
          align-self: start;
        }

        > :not([data-current], [data-leaving]) {
          display: none;
        }
      }

      /* What is moving out takes no clicks. */
      .booking [data-leaving] {
        pointer-events: none;
      }

      .month {
        display: grid;
        gap: 0.25rem;
        padding-block: 0.25rem;
      }

      .stay {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        min-height: var(--size-control-small);
        padding: 1px 0.75rem 0;
        border-radius: var(--radius-control);
        white-space: nowrap;

        &.booked {
          color: var(--color-ink-soft);
        }

        &:not(.booked) {
          cursor: pointer;
          transition: background-color 0.2s;
        }

        &:not(.booked, :has(:checked)):hover {
          background: var(--color-accent-soft);
        }

        &:has(:checked) {
          background: var(--color-accent);
          color: var(--color-on-accent);

          .price {
            color: inherit;
          }
        }

        .price {
          color: var(--color-accent);
          font-weight: 500;
        }
      }

      /* A week's band runs from its first day to its last, and rounds off at a row's ends. */
      .calendar {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        row-gap: 0.25rem;
        text-align: center;
      }

      .weekday-name {
        color: var(--color-ink-soft);
        font-size: 0.8125rem;
        line-height: 1.75rem;
      }

      .day {
        display: grid;
        place-items: center;
        height: var(--day);

        > * {
          display: grid;
          place-items: center;
          width: var(--day);
          height: var(--day);
          border-radius: var(--radius-control);
        }

        .booked {
          color: var(--color-ink-soft);
          text-decoration: line-through;
        }

        &.in-band {
          background: var(--color-accent-soft);

          &:nth-child(7n + 1) {
            border-radius: var(--radius-control) 0 0 var(--radius-control);
          }

          &:nth-child(7n) {
            border-radius: 0 var(--radius-control) var(--radius-control) 0;
          }
        }

        /* The band starts and ends under the middle of its circles, not at the cell's edge. */
        &.band-start {
          background: linear-gradient(to right, transparent 50%, var(--color-accent-soft) 50%);
        }

        &.band-end {
          background: linear-gradient(to left, transparent 50%, var(--color-accent-soft) 50%);
        }

        &.band-start > *,
        &.band-end > * {
          background: var(--color-accent);
          color: var(--color-on-accent);
          text-decoration: none;
        }
      }

      .start {
        position: relative;
        border: 1px solid var(--color-accent);
        color: var(--color-accent);
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;

        &:hover {
          background: var(--color-accent-soft);
        }
      }

      .panel-empty {
        margin-top: 0.75rem;
        color: var(--color-ink-soft);
      }

      .guests,
      .outcome {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid var(--color-line);
      }

      .guests h3 {
        margin-bottom: 0.5rem;
      }

      /* The selects line up below their labels, however many lines a label takes. */
      .counts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-template-rows: auto auto;
        gap: 0.375rem 1rem;
      }

      .count {
        display: grid;
        grid-row: span 2;
        grid-template-rows: subgrid;

        label {
          align-self: end;
        }

        small {
          color: var(--color-ink-soft);
          font-size: 0.9375rem;
          white-space: nowrap;
        }

        .guests-title {
          font-size: 1.0625rem;
          font-weight: 500;
        }
      }

      /* The copied select in the site's look: a pill like the other controls, its list a menu's
         card. Here and not in ui.css, so that it loads only with the page that uses it. */
      .spartan-select-trigger {
        gap: 0.5rem;
        min-height: var(--size-control);
        padding: 0 0.875rem 0 1rem;
        border: 1px solid var(--color-edge);
        border-radius: var(--radius-control);
        background: var(--color-surface);
        font-weight: 500;
        cursor: pointer;
        transition: border-color 0.2s;

        &:hover,
        &[aria-expanded='true'] {
          border-color: var(--color-accent);
        }
      }

      .spartan-select-trigger-icon {
        color: var(--color-ink-soft);
        transition: rotate 0.2s;

        [aria-expanded='true'] > & {
          rotate: 180deg;
        }
      }

      .spartan-select-content {
        flex-direction: column;
        max-height: min(18rem, var(--brn-select-content-available-height, 18rem));
        padding: 0.375rem;
        border-radius: var(--radius-menu);
        background: var(--color-surface);
        box-shadow: var(--shadow-card);
      }

      .spartan-select-item {
        justify-content: space-between;
        min-height: var(--size-control-small);
        padding: 0 0.75rem;
        border-radius: 0.5rem;
        font-weight: 500;
        cursor: pointer;

        &[data-highlighted] {
          background: var(--color-ground);
        }
      }

      .spartan-select-item-indicator {
        color: var(--color-accent);
      }

      .babies,
      .panel-note {
        margin-top: 0.75rem;
        color: var(--color-ink-soft);
        font-size: 0.875rem;
      }

      .total {
        font-size: 0.9375rem;

        div {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          padding-block: 0.25rem;
        }

        dt {
          color: var(--color-ink-soft);
        }

        dd {
          white-space: nowrap;
        }

        .sum {
          margin-top: 0.375rem;
          padding-top: 0.625rem;
          border-top: 1px solid var(--color-line);
          font-size: 1.1875rem;
          font-weight: 500;

          dt {
            color: var(--color-ink);
          }
        }
      }

      .from {
        color: var(--color-ink-soft);

        strong {
          color: var(--color-ink);
          font-size: 1.1875rem;
          font-weight: 500;
        }
      }

      .button.wide {
        justify-content: center;
        gap: 0.5rem;
        width: 100%;
        margin-top: 1rem;

        &:disabled {
          background: var(--color-line);
          color: var(--color-ink-soft);
          box-shadow: none;
        }
      }

      .panel-note {
        text-align: center;
      }
    }
  `,
  host: { class: 'booking' },
})
export class BookingPanel {
  protected readonly texts = inject(TEXTS);
  private readonly language = inject(LANGUAGE);
  private readonly season = inject(Season);
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly route = inject(ActivatedRoute).snapshot;
  protected readonly fill = fill;
  protected readonly childAge = site.childAge;
  protected readonly views = ['list', 'calendar'] as const;
  // The copied trigger takes its outline away; its ring is the site's, as on every control.
  protected readonly trigger =
    'w-full focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent';

  protected readonly weeks: FreeWeeks | null = this.route.data['weeks'];
  protected readonly limits: Listing | null = this.route.data['listing'];
  private readonly slug: string = this.route.params['slug'];

  private readonly dates = new Intl.DateTimeFormat(this.language.tag, {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  });
  protected readonly short = new Intl.DateTimeFormat(this.language.tag, {
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  });
  protected readonly spoken = new Intl.DateTimeFormat(this.language.tag, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  private readonly monthYear = new Intl.DateTimeFormat(this.language.tag, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  private readonly plural = new Intl.PluralRules(this.language.tag);
  // Monday first; a short weekday's full stop, as in "Mo.", is left out.
  protected readonly weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(this.language.tag, { weekday: 'short', timeZone: 'UTC' })
      .format(new Date(Date.UTC(2024, 0, 1 + i)))
      .replace('.', ''),
  );

  protected readonly view = signal<'list' | 'calendar'>('list');
  protected readonly chosen = signal<{ season: SeasonName; arrival: string } | null>(null);
  protected readonly adults = signal(1);
  protected readonly children = signal(0);
  protected readonly roomForChildren = computed(() =>
    Math.min(this.limits?.maxChildren ?? 0, (this.limits?.maxPeople ?? 0) - this.adults()),
  );
  // The month each season shows, by its index in the season.
  private readonly months = signal<Partial<Record<SeasonName, number>>>({});
  protected readonly announced = signal('');
  protected readonly barShown = signal(false);
  // Set by the panel's button: the next season comes from the right, the current from the left.
  private direction = 0;
  private readonly swapSeason = swapper();
  private readonly swapMonth = swapper();

  protected readonly taxLine = computed(() => {
    const tax = this.weeks?.tax;
    if (!tax) return null;
    const count = this.adults();
    const forms = this.limits?.maxChildren ? this.texts.panel.adults : this.texts.weeks.guests;
    const guests = fill(this.plural.select(count) === 'one' ? forms.one : forms.other, { count });
    const nights = 7;
    const times = tax.per === 'night' ? count * nights : count;
    return {
      text: fill(this.texts.panel.tax[tax.per], {
        guests,
        nights,
        amount: this.money(tax.amount),
      }),
      amount: Math.round(tax.amount * times * 100) / 100,
    };
  });

  // The bar's line per season: the chosen week's total, or the season's lowest price.
  protected readonly barLines = computed(() =>
    this.weeks!.seasons.flatMap((season): BarLine[] => {
      const stay = this.pickIn(season.name);
      if (stay)
        return [
          {
            season: season.name,
            before: '',
            amount: this.money(stay.price! + (this.taxLine()?.amount ?? 0)),
            after: '',
            detail: this.stayText(stay),
            link: this.bookingLink(stay),
            label: this.texts.panel.bar.book,
          },
        ];
      if (season.state !== 'open') return [];
      const [before, after] = this.texts.panel.from.split('{price}');
      return [
        {
          season: season.name,
          before,
          amount: this.money(this.lowest(season)),
          after,
          detail: '',
          link: null,
          label: this.texts.panel.bar.choose,
        },
      ];
    }),
  );

  constructor() {
    this.read();
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(this.season.watch((name) => this.move(name)));
    afterNextRender(() => {
      const panel = this.host.querySelector('.panel')!;
      const seen = new IntersectionObserver(([entry]) => this.barShown.set(!entry.isIntersecting));
      seen.observe(panel);
      const sized = new ResizeObserver(() =>
        this.host.style.setProperty('--height', `${this.host.offsetHeight}px`),
      );
      sized.observe(this.host);
      destroyRef.onDestroy(() => {
        seen.disconnect();
        sized.disconnect();
      });
    });
  }

  // The address's choice: a free week of either season, and the guests within the limits.
  private read() {
    const query = this.route.queryParamMap;
    const arrival = query.get('arrival');
    const season = this.weeks?.seasons.find((one) =>
      one.weeks.some((week) => week.arrival === arrival && week.prices[0] !== null),
    );
    if (season && arrival) {
      this.chosen.set({ season: season.name, arrival });
      const index = this.monthsOf(season).findIndex(({ key }) => key === arrival.slice(0, 7));
      this.months.set({ [season.name]: index });
    }
    const count = (name: string, fallback: number) =>
      Math.floor(Number(query.get(name) ?? fallback)) || 0;
    this.adults.set(Math.min(Math.max(count('adults', 2), 1), this.limits?.maxAdults ?? 1));
    this.children.set(Math.min(Math.max(count('children', 0), 0), this.roomForChildren()));
  }

  // The weeks by the month they arrive in, each month also as a calendar of six rows.
  private readonly monthCache = new Map<SeasonName, Month[]>();
  protected monthsOf(season: SeasonWeeks): Month[] {
    const cached = this.monthCache.get(season.name);
    if (cached) return cached;
    const stays: Stay[] = season.weeks.map(({ arrival, departure, prices }) => ({
      arrival,
      departure,
      price: prices[0],
    }));
    const keys = [...new Set(stays.map(({ arrival }) => arrival.slice(0, 7)))];
    const months = keys.map((key) => {
      const [year, month] = key.split('-').map(Number);
      const first = Date.UTC(year, month - 1, 1);
      const lead = (new Date(first).getUTCDay() + 6) % 7;
      const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const days = Array.from({ length: 42 }, (_, i): Day => {
        const number = i - lead + 1;
        const date = addDays(`${key}-01`, i - lead);
        if (number < 1 || number > length) return { date, day: null, booked: false };
        const start = stays.find((stay) => stay.arrival === date && stay.price !== null);
        const booked = stays.some(
          (stay) => stay.price === null && stay.arrival <= date && date < stay.departure,
        );
        return { date, day: number, start, booked };
      });
      return {
        key,
        name: this.monthYear.format(new Date(first)),
        stays: stays.filter(({ arrival }) => arrival.startsWith(key)),
        days,
      };
    });
    this.monthCache.set(season.name, months);
    return months;
  }

  protected month(season: SeasonName) {
    return this.months()[season] ?? 0;
  }

  protected dated(season: SeasonWeeks) {
    const name = this.texts.seasons[season.name]!;
    return season.years ? `${name} ${season.years}` : name;
  }

  protected other(name: SeasonName) {
    return this.weeks!.seasons.find((season) => season.name !== name)!;
  }

  protected range(from: number, to: number) {
    return Array.from({ length: Math.max(to - from + 1, 0) }, (_, i) => from + i);
  }

  protected stayText({ arrival, departure }: Stay, dates = this.dates) {
    return `${dates.format(new Date(arrival))} – ${dates.format(new Date(departure))}`;
  }

  protected money(amount: number) {
    const digits = Number.isInteger(amount) ? 0 : 2;
    return new Intl.NumberFormat(this.language.tag, {
      style: 'currency',
      currency: this.weeks!.currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  }

  protected lowest(season: SeasonWeeks) {
    return Math.min(...season.weeks.flatMap(({ prices }) => prices[0] ?? []));
  }

  protected isChosen(season: SeasonName, stay: Stay) {
    const pick = this.chosen();
    return pick?.season === season && pick.arrival === stay.arrival;
  }

  protected pickIn(season: SeasonName): Stay | null {
    const pick = this.chosen();
    if (pick?.season !== season) return null;
    const seasonWeeks = this.weeks!.seasons.find(({ name }) => name === season)!;
    return this.monthsOf(seasonWeeks)
      .flatMap(({ stays }) => stays)
      .find(({ arrival }) => arrival === pick.arrival)!;
  }

  // The chosen week's days in a calendar: from its first day to its last.
  protected bandOf(season: SeasonName, date: string) {
    const pick = this.pickIn(season);
    if (!pick) return { in: false, start: false, end: false };
    return {
      in: date > pick.arrival && date < pick.departure,
      start: date === pick.arrival,
      end: date === pick.departure,
    };
  }

  protected bookingLink(stay: Stay) {
    const query = new URLSearchParams({
      arrival: stay.arrival,
      departure: stay.departure,
      adults: String(this.adults()),
    });
    if (this.limits?.maxChildren) query.set('children', String(this.children()));
    return `${address(this.language, 'book', this.slug)}?${query}`;
  }

  protected choose(season: SeasonName, stay: Stay) {
    this.chosen.set({ season, arrival: stay.arrival });
    this.keep();
  }

  // More adults than leave room for the children lower the children's count.
  protected setAdults(value: number) {
    this.adults.set(value);
    this.children.set(Math.min(this.children(), this.roomForChildren()));
    this.keep();
  }

  protected setChildren(value: number) {
    this.children.set(value);
    this.keep();
  }

  // The address keeps the choice; the season's own parameter is the season service's.
  private keep() {
    const [path, query = ''] = this.location.path().split('?');
    const params = new URLSearchParams(query.split('#')[0]);
    const pick = this.chosen();
    const stay = pick && this.pickIn(pick.season);
    if (stay) {
      params.set('arrival', stay.arrival);
      params.set('departure', stay.departure);
    }
    params.set('adults', String(this.adults()));
    if (this.limits?.maxChildren) params.set('children', String(this.children()));
    this.location.replaceState(path, params.toString(), this.location.getState());
  }

  // A change of view fades the new one in; the month and the chosen week stay.
  protected show(name: 'list' | 'calendar') {
    this.view.set(name);
    afterNextRender(
      {
        write: () => {
          if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
          this.host
            .querySelectorAll('.month[data-current]')
            .forEach((month) =>
              month.animate({ opacity: [0, 1] }, { duration: 250, easing: 'ease-out' }),
            );
        },
      },
      { injector: this.injector },
    );
  }

  // The next or the previous month slides in from its side. At the season's first or last month
  // the button turns off, and the focus goes to the other one.
  protected page(season: SeasonWeeks, by: -1 | 1) {
    const from = this.month(season.name);
    const box = this.host.querySelector<HTMLElement>(`[data-for=${season.name}] .months`)!;
    const old = box.querySelector<HTMLElement>(`[data-month="${from}"]`)!;
    const height = box.offsetHeight;
    this.months.update((months) => ({ ...months, [season.name]: from + by }));
    this.announced.set(this.monthsOf(season)[from + by].name);
    afterNextRender(
      {
        write: () => {
          const next = box.querySelector<HTMLElement>(`[data-month="${from + by}"]`)!;
          this.swapMonth(box, old, next, by, height);
          const head = box.previousElementSibling!;
          const buttons = [...head.querySelectorAll('button')];
          if (buttons.some((button) => button.disabled && button === document.activeElement))
            buttons.find((button) => !button.disabled)?.focus();
        },
      },
      { injector: this.injector },
    );
  }

  protected slide() {
    const [first, second] = this.weeks!.seasons;
    const to = this.season.current() === first.name ? second : first;
    this.direction = to === second ? 1 : -1;
    this.announced.set(`${this.texts.panel.title} ${this.dated(to)}`);
    this.season.switch(to.name);
  }

  // Before the change: the season shown now and its height. After it, the old one is held in
  // view while it leaves.
  private move(to: SeasonName) {
    const direction = this.direction;
    this.direction = 0;
    const box = this.host.querySelector<HTMLElement>('.panel-seasons');
    const old = box?.querySelector<HTMLElement>(`[data-for=${this.season.current()}]`);
    const height = box?.offsetHeight;
    return () => {
      const next = box?.querySelector<HTMLElement>(`[data-for=${to}]`);
      if (box && old && next) this.swapSeason(box, old, next, direction, height!);
    };
  }
}
