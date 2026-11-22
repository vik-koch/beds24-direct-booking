import { Grid, GridCell, GridRow } from '@angular/aria/grid';
import { DOCUMENT, isPlatformServer, Location } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  InjectionToken,
  Injector,
  PLATFORM_ID,
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
  lucideInfo,
  lucideList,
} from '@ng-icons/lucide';
import type { Listing } from '../beds24/client';
import type { FreeWeeks } from '../beds24/weeks';
import site from '../content/generated/site';
import type { SeasonName } from '../content/names';
import { BookingBar, type BarLine } from './booking-bar';
import { Choice, fits, taxed, taxFor } from './choice';
import { GuestCounts } from './guest-counts';
import { Season } from './season';
import { swapper } from './swap';
import { address, fill, formatMoney, formatStay, LANGUAGE, replaceQuery, TEXTS } from './texts';

type SeasonWeeks = FreeWeeks['seasons'][number];
interface Stay {
  arrival: string;
  departure: string;
  price: number | null;
}
// A day of a month's calendar, which may be one of the month before or after; a free week's
// first day starts it.
interface Day {
  date: string;
  day: number;
  start?: Stay;
  booked: boolean;
  label: string;
}
interface Month {
  key: string;
  name: string;
  stays: Stay[];
  rows: Day[][];
}
type View = 'list' | 'calendar';

// Each season's shown month, by its key. In the root injector, so that it outlives a change of
// language, which replaces the page's components.
const shownMonths = new InjectionToken('booking panel months', {
  providedIn: 'root',
  factory: () => signal<Partial<Record<SeasonName, string>>>({}),
});

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
  imports: [NgIcon, BookingBar, GuestCounts, Grid, GridRow, GridCell],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideArrowRight,
      lucideCalendar,
      lucideChevronLeft,
      lucideChevronRight,
      lucideInfo,
      lucideList,
    }),
  ],
  template: `
    <!-- The section's name is the title's and the season's. -->
    <section id="booking" class="panel" aria-labelledby="booking-title booking-season">
      <div class="panel-line">
        <h2 id="booking-title" class="panel-title" tabindex="-1">{{ texts.panel.title }}</h2>
        @if (weeks && limits) {
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
        }
      </div>
      @if (weeks?.seasons?.[0]?.years) {
        <p id="booking-season" class="weeks-season stack">
          @for (season of weeks!.seasons; track season.name) {
            <span [attr.data-for]="season.name">{{ dated(season) }}</span>
          }
        </p>
        @if (limits && weeks!.seasons.length === 2) {
          <!-- One button whose label follows the season, so that it keeps the focus. -->
          <button type="button" class="other-season stack" (click)="slide()">
            @for (season of weeks!.seasons; track season.name) {
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
      }
      @if (weeks && limits) {
        <p class="sr-only" aria-live="polite">{{ announced() }}</p>
        <div class="panel-seasons">
          @for (season of weeks.seasons; track season.name) {
            <div class="panel-season" [attr.data-for]="season.name">
              @if (season.state === 'open') {
                @let shown = month(season);
                @let months = monthsOf(season);
                <!-- The buttons stay over the months, whose names move with them. -->
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
                      [attr.data-month]="$index"
                      [attr.data-current]="$index === shown ? '' : null"
                    >
                      @let name = 'month-' + season.name + '-' + $index;
                      <h3 class="month-name" [id]="name">{{ month.name }}</h3>
                      <!-- As on the home page: a grid whose cells choose a week, and choose it no
                           more when it is chosen. A row or a day of the month before or after
                           leads to that month. -->
                      @let stop = stopIn(season.name, month);
                      @if (view() === 'list') {
                        <div
                          class="month-weeks"
                          ngGrid
                          enableSelection
                          selectionMode="explicit"
                          rowWrap="nowrap"
                          colWrap="nowrap"
                          [attr.aria-labelledby]="name"
                        >
                          @for (stay of month.stays; track stay.arrival) {
                            <div
                              class="week"
                              ngGridRow
                              [class.full]="stay.price === null"
                              [class.outside]="!stay.arrival.startsWith(month.key)"
                              [class.chosen]="isChosen(season.name, stay)"
                            >
                              <!-- Every week starts on the same weekday, so a row leaves it
                                   out; the row header's label says it. -->
                              <span
                                role="rowheader"
                                aria-colindex="1"
                                [attr.aria-label]="stayText(stay, spoken)"
                                >{{ stayText(stay, short) }}</span
                              >
                              <span
                                ngGridCell
                                class="week-cell"
                                [colIndex]="2"
                                [selectable]="stay.price !== null"
                                [selected]="isChosen(season.name, stay)"
                                (selectedChange)="select($event, season, stay)"
                                [tabindex]="stop ? (stop === stay.arrival ? 0 : -1) : undefined"
                                [attr.data-date]="stay.arrival"
                                (click)="guard($event, stay.price !== null)"
                                (keydown)="keys($event, season, stay.price !== null)"
                                >{{
                                  stay.price === null ? texts.weeks.taken : money(stay.price)
                                }}</span
                              >
                            </div>
                          }
                        </div>
                      } @else {
                        <div
                          class="calendar"
                          ngGrid
                          enableSelection
                          selectionMode="explicit"
                          rowWrap="nowrap"
                          colWrap="nowrap"
                          [attr.aria-labelledby]="name"
                        >
                          <div class="calendar-row" role="row" aria-rowindex="1">
                            @for (name of weekdays; track $index) {
                              <span
                                role="columnheader"
                                class="weekday-name"
                                [attr.aria-label]="name.long"
                                >{{ name.short }}</span
                              >
                            }
                          </div>
                          @for (row of month.rows; track $index) {
                            <div class="calendar-row" ngGridRow [rowIndex]="$index + 2">
                              @for (cell of row; track cell.date) {
                                @let band = bandOf(season.name, cell.date);
                                <span
                                  ngGridCell
                                  class="day"
                                  [class.outside]="!cell.date.startsWith(month.key)"
                                  [class.in-band]="band.in"
                                  [class.band-start]="band.start"
                                  [class.band-end]="band.end"
                                  [selectable]="!!cell.start"
                                  [selected]="!!cell.start && isChosen(season.name, cell.start)"
                                  (selectedChange)="
                                    cell.start && select($event, season, cell.start)
                                  "
                                  [attr.aria-label]="cell.label"
                                  [tabindex]="stop ? (stop === cell.date ? 0 : -1) : undefined"
                                  [attr.data-date]="cell.date"
                                  (click)="guard($event, !!cell.start)"
                                  (keydown)="keys($event, season, !!cell.start)"
                                  ><span [class.start]="cell.start" [class.booked]="cell.booked">{{
                                    cell.day
                                  }}</span></span
                                >
                              }
                            </div>
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
          @if (choice.asksChildren()) {
            <h3>{{ texts.panel.guests }}</h3>
          }
          <app-guest-counts />
          <!-- Beside the counts that would make the apartment fit. -->
          <p class="too-small" role="status">
            @if (!fitting()) {
              <ng-icon name="lucideInfo" aria-hidden="true" />{{ small() }}
            }
          </p>
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
                @if (fitting()) {
                  <a class="button wide" [href]="bookingLink(stay)"
                    >{{ texts.panel.book }}<ng-icon name="lucideArrowRight" aria-hidden="true"
                  /></a>
                } @else {
                  <button type="button" class="button wide" disabled>{{ texts.panel.book }}</button>
                }
              } @else {
                @let from = texts.panel.from.split('{price}');
                <p class="from">
                  {{ from[0] }}<strong>{{ money(lowest(season)) }}</strong
                  >{{ from[1] }}
                </p>
                <button type="button" class="button wide" disabled>{{ texts.panel.choose }}</button>
              }
            </div>
          }
        }
      } @else {
        <p class="panel-empty">{{ texts.weeks.unavailable }}</p>
      }
    </section>
    @if (weeks && limits) {
      <app-booking-bar
        [lines]="barLines()"
        [shown]="barShown()"
        (cleared)="clear()"
        (pressed)="onward()"
      />
    }
  `,
  styles: `
    @layer components {
      .booking {
        display: block;

        /* On a phone the bar stays at the screen's foot. */
        .booking-bar {
          position: fixed;
          inset: auto 1rem 1rem;
          z-index: 15;

          @media (min-width: 64rem) {
            display: none;
          }
        }

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
        /* The phone bar brings the panel's foot as far from the screen's foot as from its sides. */
        scroll-margin-bottom: 1rem;

        @media (min-width: 48rem) {
          --inset: 2rem;
          padding-block: 2rem;
        }

        /* Sized as the page's other headings. */
        .panel-title {
          margin: 0;
          line-height: 1.2;
        }

        /* The view's radios are the labels round them, which draw their rings. */
        input[type='radio'] {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        label:has(:focus-visible) {
          outline: var(--focus-ring);
          outline-offset: 2px;
        }

        h3 {
          font-size: 1.0625rem;
          font-weight: 500;
        }
      }

      /* The title with the view's switch, which reaches a little past the line so that the
         season's name stands as close below as a heading's second line; then the way to the
         other season. */
      .panel-line {
        display: flex;
        align-items: center;
        justify-content: space-between;
        column-gap: 1rem;
      }

      .panel > .weeks-season {
        display: grid;
        font-size: var(--size-heading);
        letter-spacing: -0.01em;
        line-height: 1.2;
      }

      .panel .other-season {
        margin-top: 0.125rem;
        font-size: 0.9375rem;

        @media (min-width: 48rem) {
          justify-items: start;
        }
      }

      /* Two icons in a pill; the accent part glides to the chosen one, as in the season switch. */
      .views {
        grid-template-columns: repeat(2, var(--narrow));
        margin-block: -0.3125rem;
        margin-left: auto;
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

      /* The seasons, and in each its months, lie in one place, so one can slide over another.
         Each clips at the card's edges, which a move crosses whole; the focus rings of the parts
         at the sides have room inside. */
      .panel-seasons,
      .months {
        display: grid;
        margin-inline: calc(-1 * var(--inset));
        padding-inline: var(--inset);
        overflow: clip;
      }

      /* The room above is the season's, so the ring of a month's button fits in its clip. */
      .panel-season {
        position: relative;
        grid-area: 1 / 1;
        align-self: start;
        padding-top: 0.5rem;
      }

      /* Over the months' first line, which holds their names. */
      .month-head {
        position: absolute;
        inset: 0.5rem 0 auto;
        z-index: 1;
        display: flex;
        justify-content: space-between;
        pointer-events: none;

        .icon-button {
          pointer-events: auto;
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

      /* The name, then six lines in both views, the list's below as much room as the calendar's
         weekdays: as tall as each other in every month, so nothing below moves. */
      .months {
        --day: var(--size-control-small);
        --gap: 0.25rem;
        --head: 1.5rem;
        height: calc(
          var(--size-control) + var(--head) + 6 * var(--gap) + 6 * var(--day) + 0.375rem
        );

        > * {
          grid-area: 1 / 1;
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
        padding-bottom: 0.375rem;
      }

      .month-name {
        line-height: var(--size-control);
        text-align: center;
      }

      .month-weeks,
      .calendar {
        display: grid;
        gap: var(--gap);
      }

      .month-weeks {
        padding-top: calc(var(--head) + var(--gap));
      }

      /* The cell is the price, but the whole row chooses it and is its pill. */
      .week {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        min-height: var(--day);
        padding: 1px 0.75rem 0;
        border-radius: var(--radius-control);
        white-space: nowrap;

        &.full {
          color: var(--color-ink-soft);
        }

        &:not(.full) {
          cursor: pointer;
        }

        &.chosen {
          background: var(--color-accent);
          color: var(--color-on-accent);
        }

        &:has(:focus-visible) {
          outline: var(--focus-ring);
          outline-offset: 2px;
        }

        /* On the narrowest screens a smaller size keeps both on one line. */
        @media (max-width: 22.4375rem) {
          font-size: 1rem;
        }
      }

      .week-cell {
        &:focus-visible {
          outline: none;
        }

        &::after {
          content: '';
          position: absolute;
          inset: 0;
        }

        .week:not(.full) & {
          font-weight: 500;
        }

        .week:not(.full, .chosen) & {
          color: var(--color-accent);
        }
      }

      /* Weeks and days of the month before or after, there to lead to it, in the soft ink. */
      .week.outside:not(.chosen),
      .week.outside:not(.chosen) .week-cell,
      .day.outside:not(.band-start, .band-end) > * {
        border-color: currentcolor;
        color: var(--color-ink-soft);
      }

      /* A week's band runs from its first day to its last, and rounds off at a row's ends. */
      .calendar-row {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        text-align: center;
      }

      .weekday-name {
        color: var(--color-ink-soft);
        font-size: 0.8125rem;
        line-height: var(--head);
      }

      .day {
        display: grid;
        place-items: center;
        height: var(--day);

        &:has(.start) {
          cursor: pointer;
        }

        &:focus-visible {
          outline: none;

          > * {
            outline: var(--focus-ring);
            outline-offset: 2px;
          }
        }

        > * {
          display: grid;
          place-items: center;
          width: min(2.5rem, 100%);
          height: var(--day);
          border-radius: var(--radius-control);
        }

        .booked {
          color: var(--color-ink-soft);
          text-decoration: line-through;
        }

        &.in-band {
          background: var(--color-accent-soft);

          &:first-child {
            border-radius: var(--radius-control) 0 0 var(--radius-control);
          }

          &:last-child {
            border-radius: 0 var(--radius-control) var(--radius-control) 0;
          }
        }

        /* The band starts and ends under the middle of its pills, not at the cell's edge. */
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
        border: 1px solid var(--color-accent);
        color: var(--color-accent);
        font-weight: 500;
      }

      .panel-empty {
        margin-top: 0.75rem;
        color: var(--color-ink-soft);

        .panel-season > & {
          margin-bottom: 1rem;
        }
      }

      .guests,
      .outcome {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid var(--color-line);
      }

      /* The months' last line has some air below it already. */
      .panel-seasons + .guests {
        margin-top: 0.5rem;
      }

      .guests h3 {
        margin-bottom: 0.5rem;
      }

      .too-small:not(:empty) {
        margin-top: 0.75rem;
      }

      /* The total's rows bring their own padding, so it starts as close to its line as the sum. */
      .outcome:has(.total) {
        padding-top: 0.625rem;
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
  protected readonly views = ['list', 'calendar'] as const;

  protected readonly weeks: FreeWeeks | null = this.route.data['weeks'];
  protected readonly limits: Listing | null = this.route.data['listing'];
  private readonly slug: string = this.route.params['slug'];
  private readonly name = site.apartments.find(({ slug }) => slug === this.slug)!.name;

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
  private readonly dayMonth = new Intl.DateTimeFormat(this.language.tag, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  private readonly plural = new Intl.PluralRules(this.language.tag);
  // Monday first; a short weekday's full stop, as in "Mo.", is left out.
  protected readonly weekdays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(2024, 0, 1 + i));
    const name = (weekday: 'short' | 'long') =>
      new Intl.DateTimeFormat(this.language.tag, { weekday, timeZone: 'UTC' }).format(date);
    return { short: name('short').replace('.', ''), long: name('long') };
  });

  private readonly months = inject(shownMonths);
  protected readonly chosen = signal<{ season: SeasonName; arrival: string } | null>(null);
  protected readonly choice = inject(Choice);
  // In the root injector, so that links carry it to the next apartment.
  protected readonly view = this.choice.view;
  // The apartment's own limits, which the choice for every apartment may exceed.
  protected readonly fitting = computed(
    () => !this.limits || fits(this.limits, this.choice.adults(), this.choice.children()),
  );
  protected readonly small = computed(() => {
    const count = this.limits!.maxPeople;
    const { one, other } = this.texts.weeks.guests;
    return fill(this.texts.panel.small, {
      name: this.name,
      guests: fill(this.plural.select(count) === 'one' ? one : other, { count }),
    });
  });
  protected readonly announced = signal('');
  private readonly document = inject(DOCUMENT);
  // As the server's script left it at the first paint.
  protected readonly barShown = signal(
    this.document.querySelector<HTMLElement>('.booking-bar')?.hidden !== true,
  );
  // Set by the panel's button: the next season comes from the right, the current from the left.
  private direction = 0;
  private readonly swapSeason = swapper();
  private readonly swapMonth = swapper();

  protected readonly taxLine = computed(() => {
    const tax = this.weeks?.tax;
    if (!tax || !this.limits) return null;
    const count = taxed(this.limits, this.choice.adults(), this.choice.children());
    const forms = this.limits.asksChildren ? this.texts.panel.adults : this.texts.weeks.guests;
    const guests = fill(this.plural.select(count) === 'one' ? forms.one : forms.other, { count });
    return {
      text: fill(this.texts.panel.tax[tax.per], {
        guests,
        nights: 7,
        amount: this.money(tax.amount),
      }),
      amount: taxFor(tax, count),
    };
  });

  // The bar's line per season: the chosen week's price, or the season's lowest. The total with the
  // tax, which depends on the guests, is the panel's.
  protected readonly barLines = computed(() =>
    this.weeks!.seasons.flatMap((season): BarLine[] => {
      const stay = this.pickIn(season.name);
      if (stay)
        return [
          {
            season: season.name,
            name: this.name,
            before: '',
            amount: this.money(stay.price!),
            after: '',
            detail: this.fitting() ? this.stayText(stay) : this.small(),
            link: null,
            label: this.fitting() ? this.texts.panel.bar.book : this.texts.panel.guests,
            chosen: true,
          },
        ];
      if (season.state !== 'open') return [];
      const [before, after] = this.texts.panel.from.split('{price}');
      return [
        {
          season: season.name,
          name: '',
          before,
          amount: this.money(this.lowest(season)),
          after,
          detail: '',
          link: null,
          label: this.texts.panel.bar.choose,
          chosen: false,
        },
      ];
    }),
  );

  constructor() {
    this.read();
    // At the first paint the bar shows unless the panel is already in view, as on a tall tablet.
    if (isPlatformServer(inject(PLATFORM_ID))) {
      const script = this.document.createElement('script');
      script.textContent =
        '{let b=document.querySelector(".booking-bar");' +
        'if(b&&document.getElementById("booking").getBoundingClientRect().top<innerHeight)b.hidden=true}';
      this.document.body.appendChild(script);
    }
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(this.season.watch((name) => this.move(name)));
    afterNextRender(() => {
      const panel = this.host.querySelector('.panel')!;
      // The root reaches far above the screen, so a panel scrolled past counts as seen.
      const seen = new IntersectionObserver(([entry]) => this.barShown.set(!entry.isIntersecting), {
        rootMargin: '100000px 0px 0px',
      });
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
    // A month browsed to before a change of language stays shown.
    if (season && arrival) {
      this.chosen.set({ season: season.name, arrival });
      if (!this.months()[season.name])
        this.months.update((months) => ({ ...months, [season.name]: arrival.slice(0, 7) }));
    }
    this.carry();
    if (this.weeks) this.choice.limit(Object.values(this.weeks.capacities));
  }

  // The weeks by the month they arrive in, with the week before that ends in it, and each month
  // as a calendar of six rows from the Monday before its first day.
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
      const first = new Date(`${key}-01`);
      const lead = (first.getUTCDay() + 6) % 7;
      const days = Array.from({ length: 42 }, (_, i): Day => {
        const date = addDays(`${key}-01`, i - lead);
        const start = stays.find((stay) => stay.arrival === date && stay.price !== null);
        const booked = stays.some(
          (stay) => stay.price === null && stay.arrival <= date && date < stay.departure,
        );
        const named = this.dayMonth.format(new Date(date));
        return {
          date,
          day: Number(date.slice(8)),
          start,
          booked,
          label: start
            ? `${this.stayText(start, this.spoken)}, ${this.money(start.price!)}`
            : booked
              ? `${named}, ${this.texts.weeks.taken}`
              : named,
        };
      });
      return {
        key,
        name: this.monthYear.format(first),
        stays: stays.filter(
          ({ arrival, departure }) => departure.startsWith(key) || arrival.startsWith(key),
        ),
        rows: Array.from({ length: 6 }, (_, row) => days.slice(row * 7, row * 7 + 7)),
      };
    });
    this.monthCache.set(season.name, months);
    return months;
  }

  protected month(season: SeasonWeeks) {
    const key = this.months()[season.name];
    return Math.max(
      this.monthsOf(season).findIndex((month) => month.key === key),
      0,
    );
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

  protected stayText(stay: Stay, dates = this.dates) {
    return formatStay(dates, stay);
  }

  protected money(amount: number) {
    return formatMoney(this.language.tag, this.weeks!.currency, amount);
  }

  protected lowest(season: SeasonWeeks) {
    return Math.min(...season.weeks.flatMap(({ prices }) => prices[0] ?? []));
  }

  // Tab enters a month at its chosen week, wherever the focus last left the month.
  protected stopIn(season: SeasonName, month: Month) {
    const pick = this.chosen();
    if (pick?.season !== season) return null;
    const here =
      this.view() === 'list'
        ? month.stays.some(({ arrival }) => arrival === pick.arrival)
        : month.rows.some((row) => row.some(({ date }) => date === pick.arrival));
    return here ? pick.arrival : null;
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
    const { arrival, departure } = stay;
    const query = new URLSearchParams({ arrival, departure, ...this.choice.params() });
    return `${address(this.language, 'book', this.slug)}?${query}`;
  }

  // A week chosen in the month before or after shows that month.
  protected select(selected: boolean, season: SeasonWeeks, stay: Stay) {
    if (selected) this.chosen.set({ season: season.name, arrival: stay.arrival });
    else if (this.isChosen(season.name, stay)) this.chosen.set(null);
    this.keep();
    const to = this.monthsOf(season).findIndex(({ key }) => stay.arrival.startsWith(key));
    const from = this.month(season);
    if (selected && to !== from) this.page(season, to - from, stay.arrival);
  }

  // The bar's cross. The focus goes to the button that takes its place: the week in the panel
  // lies below the screen.
  protected clear() {
    this.chosen.set(null);
    this.keep();
    afterNextRender(
      () =>
        this.host
          .querySelector<HTMLElement>(`.booking-bar [data-for=${this.season.current()}] .button`)
          ?.focus(),
      { injector: this.injector },
    );
  }

  // The bar's button. A week that fits brings the panel's foot, its total and booking button, to
  // the screen's foot, and the focus to the button; otherwise the focus goes to the heading.
  protected onward() {
    const book = this.host.querySelector<HTMLElement>(
      `.outcome[data-for=${this.season.current()}] a.button`,
    );
    if (!book) return this.document.getElementById('booking-title')!.focus();
    book.focus({ preventScroll: true });
    this.host.querySelector('.panel')!.scrollIntoView({ block: 'end' });
  }

  // A click on a day or a booked week that does not start a free one would clear the chosen
  // week; so would Enter or Space on it. Page Up and Page Down show the month before or after.
  protected guard(event: Event, free: boolean) {
    if (!free) event.stopPropagation();
  }

  protected keys(event: KeyboardEvent, season: SeasonWeeks, free: boolean) {
    if ((event.key === 'Enter' || event.key === ' ') && !free) {
      event.stopPropagation();
      event.preventDefault();
    }
    const by = { PageUp: -1, PageDown: 1 }[event.key];
    if (!by) return;
    event.preventDefault();
    const to = this.month(season) + by;
    if (to >= 0 && to < this.monthsOf(season).length) this.page(season, by);
  }

  // The address keeps the choice, and with a week of the shown season that season, which a
  // shared link then shows first, whatever season the page would show by itself.
  private keep() {
    const pick = this.chosen();
    const stay = pick && this.pickIn(pick.season);
    replaceQuery(this.location, (params) => {
      if (stay) {
        params.set('arrival', stay.arrival);
        params.set('departure', stay.departure);
        if (pick.season === this.season.current()) params.set('season', pick.season);
      } else ['arrival', 'departure', 'season'].forEach((name) => params.delete(name));
      if (this.view() === 'calendar') params.set('view', 'calendar');
      else params.delete('view');
    });
    this.carry();
  }

  // The chosen week for the links to the home page and to this page.
  private carry() {
    const pick = this.chosen();
    const stay = pick && this.pickIn(pick.season);
    this.choice.week.set(
      stay && {
        home: address(this.language, 'home'),
        page: address(this.language, 'apartment', this.slug),
        slug: this.slug,
        arrival: stay.arrival,
        departure: stay.departure,
        season: pick.season,
      },
    );
  }

  // A change of view fades the new one in; the month and the chosen week stay.
  protected show(name: View) {
    this.view.set(name);
    this.keep();
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
  // the button turns off, and the focus goes to the other one. A focused cell's place, or the
  // given day, keeps the focus in the new month.
  protected page(season: SeasonWeeks, by: number, date?: string) {
    const from = this.month(season);
    const box = this.host.querySelector<HTMLElement>(`[data-for=${season.name}] .months`)!;
    const old = box.querySelector<HTMLElement>(`[data-month="${from}"]`)!;
    const cells = (month: Element) => [...month.querySelectorAll<HTMLElement>('[role=gridcell]')];
    const place = cells(old).indexOf(document.activeElement as HTMLElement);
    const height = box.offsetHeight;
    const month = this.monthsOf(season)[from + by];
    this.months.update((months) => ({ ...months, [season.name]: month.key }));
    this.announced.set(month.name);
    afterNextRender(
      {
        write: () => {
          const next = box.querySelector<HTMLElement>(`[data-month="${from + by}"]`)!;
          this.swapMonth(box, old, next, by, height);
          const all = cells(next);
          const cell = date
            ? next.querySelector<HTMLElement>(`[data-date="${date}"]`)
            : all[Math.min(place, all.length - 1)];
          if (place >= 0) cell?.focus({ preventScroll: true });
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
      // Back in the chosen week's season, the address names it again.
      if (this.chosen()?.season === to) this.keep();
    };
  }
}
