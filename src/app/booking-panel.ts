import { Grid, GridCell, GridRow } from '@angular/aria/grid';
import { Location } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  InjectionToken,
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
  imports: [NgIcon, HlmSelectImports, BookingBar, Grid, GridRow, GridCell],
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
        <div class="panel-line">
          <span id="booking-season" class="weeks-season stack">
            @for (season of weeks!.seasons; track season.name) {
              <span [attr.data-for]="season.name">{{ dated(season) }}</span>
            }
          </span>
          @if (limits && weeks!.seasons.length === 2) {
            <!-- One button, which keeps the focus; its arrow and its name follow the season. -->
            <button
              type="button"
              class="icon-button season-arrow stack"
              [attr.aria-label]="otherSeason()"
              [title]="otherSeason()"
              (click)="slide()"
            >
              @for (season of weeks!.seasons; track season.name) {
                <ng-icon
                  [attr.data-for]="season.name"
                  [name]="$first ? 'lucideArrowRight' : 'lucideArrowLeft'"
                  aria-hidden="true"
                />
              }
            </button>
          }
        </div>
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
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        h3 {
          font-size: 1.0625rem;
          font-weight: 500;
        }
      }

      /* Two lines nearly as close as a heading's: the title with the view's switch, which
         reaches a little past its line, and the season with the way to the other one. */
      .panel-line {
        display: flex;
        align-items: center;
        justify-content: space-between;
        column-gap: 1rem;

        + .panel-line {
          margin-top: 0.375rem;
        }

        .weeks-season {
          font-size: var(--size-heading);
          letter-spacing: -0.01em;
          line-height: 1.2;
        }
      }

      /* As small as a line of the season's name; grey on hover, as the months' buttons. */
      .season-arrow {
        width: var(--size-control-small);
        height: var(--size-control-small);
        color: var(--color-accent);
        font-size: 1.125rem;
        transition: background-color 0.2s;

        &:hover {
          background: var(--color-ground);
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
        margin-block: -0.3125rem;
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

        &:has([aria-selected='true']) {
          background: var(--color-accent);
          color: var(--color-on-accent);
        }

        &:has(:focus-visible) {
          outline: 2px solid var(--color-accent);
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

        .week:not(.full, :has([aria-selected='true'])) & {
          color: var(--color-accent);
        }
      }

      /* Weeks and days of the month before or after, there to lead to it, in the soft ink. */
      .week.outside:not(:has([aria-selected='true'])),
      .week.outside:not(:has([aria-selected='true'])) .week-cell,
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
            outline: 2px solid var(--color-accent);
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

      /* The months' last line has air below it already. */
      .panel-seasons + .guests {
        margin-top: 0;
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
  protected readonly view = signal<View>('list');
  protected readonly chosen = signal<{ season: SeasonName; arrival: string } | null>(null);
  protected readonly adults = signal(1);
  protected readonly children = signal(0);
  protected readonly roomForChildren = computed(() =>
    Math.min(this.limits?.maxChildren ?? 0, (this.limits?.maxPeople ?? 0) - this.adults()),
  );
  protected readonly announced = signal('');
  protected readonly barShown = signal(false);
  // Set by the panel's button: the next season comes from the right, the current from the left.
  private direction = 0;
  private readonly swapSeason = swapper();
  private readonly swapMonth = swapper();

  // The season button's name: the way on to the next season, or back to the current one.
  protected readonly otherSeason = computed(() => {
    const [first, second] = this.weeks!.seasons;
    return this.season.current() === first.name
      ? fill(this.texts.weeks.next, { season: this.dated(second) })
      : fill(this.texts.weeks.current, { season: this.dated(first) });
  });

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
    // A month browsed to before a change of language stays shown.
    if (season && arrival) {
      this.chosen.set({ season: season.name, arrival });
      if (!this.months()[season.name])
        this.months.update((months) => ({ ...months, [season.name]: arrival.slice(0, 7) }));
    }
    if (query.get('view') === 'calendar') this.view.set('calendar');
    const count = (name: string, fallback: number) =>
      Math.floor(Number(query.get(name) ?? fallback)) || 0;
    this.adults.set(Math.min(Math.max(count('adults', 2), 1), this.limits?.maxAdults ?? 1));
    this.children.set(Math.min(Math.max(count('children', 0), 0), this.roomForChildren()));
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
    const query = new URLSearchParams({
      arrival: stay.arrival,
      departure: stay.departure,
      adults: String(this.adults()),
    });
    if (this.limits?.maxChildren) query.set('children', String(this.children()));
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

  // The address keeps the choice, and with a week of the shown season that season, which a
  // shared link then shows first, whatever season the page would show by itself.
  private keep() {
    const [path, query = ''] = this.location.path().split('?');
    const params = new URLSearchParams(query.split('#')[0]);
    const pick = this.chosen();
    const stay = pick && this.pickIn(pick.season);
    if (stay) {
      params.set('arrival', stay.arrival);
      params.set('departure', stay.departure);
      if (pick.season === this.season.current()) params.set('season', pick.season);
    } else ['arrival', 'departure', 'season'].forEach((name) => params.delete(name));
    if (this.view() === 'calendar') params.set('view', 'calendar');
    else params.delete('view');
    params.set('adults', String(this.adults()));
    if (this.limits?.maxChildren) params.set('children', String(this.children()));
    this.location.replaceState(path, params.toString(), this.location.getState());
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
