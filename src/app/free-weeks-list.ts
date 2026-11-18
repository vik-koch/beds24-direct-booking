import { Grid, GridCell, GridRow } from '@angular/aria/grid';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideArrowRight, lucideX } from '@ng-icons/lucide';
import type { FreeWeeks } from '../beds24/weeks';
import type { SeasonName } from '../content/names';
import { Season } from './season';
import { address, fill, LANGUAGE, TEXTS } from './texts';

type SeasonWeeks = FreeWeeks['seasons'][number];

// Both seasons' rows are in the page and the page's season attribute shows one, as with the
// hero photos, so the first paint needs no script. A change of season slides the rows when it
// comes from the list's own button and cross-fades them when it comes from the header.
@Component({
  selector: 'app-free-weeks',
  imports: [NgIcon, Grid, GridRow, GridCell],
  providers: [provideIcons({ lucideArrowLeft, lucideArrowRight, lucideX })],
  template: `
    <div class="weeks-head">
      <!-- The seasons' names, and the button's labels, lie over each other: the heading and the
           button keep the size of the longer one, so nothing below moves on a change. -->
      <h2 class="headline">
        {{ texts.nav.weeks }}&ngsp;
        @if (weeks()?.seasons?.[0]?.years) {
          <span class="weeks-season stack">
            @for (season of weeks()!.seasons; track season.name) {
              <span [attr.data-for]="season.name">{{ dated(season) }}</span>
            }
          </span>
        }
      </h2>
      @if (weeks()?.seasons?.length === 2) {
        <!-- One button whose label follows the season, so that it keeps the focus. -->
        <button type="button" class="other-season stack" (click)="slide()">
          @for (season of weeks()!.seasons; track season.name) {
            <span [attr.data-for]="season.name">
              @if ($first) {
                {{ fill(texts.weeks.next, { season: dated(other(season.name)) }) }}
                <ng-icon name="lucideArrowRight" aria-hidden="true" />
              } @else {
                <ng-icon name="lucideArrowLeft" aria-hidden="true" />
                {{ fill(texts.weeks.current, { season: dated(other(season.name)) }) }}
              }
            </span>
          }
        </button>
      }
      <p class="sr-only" aria-live="polite">{{ announced() }}</p>
    </div>
    @if (weeks(); as weeks) {
      @if (weeks.apartments.length > 1) {
        <fieldset class="room-tabs">
          <legend class="sr-only">{{ texts.weeks.apartment }}</legend>
          @for (apartment of weeks.apartments; track apartment.slug) {
            <label>
              <input
                type="radio"
                name="apartment"
                [checked]="$index === tab()"
                (change)="pickTab($index)"
              />
              <span>{{ apartment.name }}</span>
            </label>
          }
        </fieldset>
      }
      <!-- The booking bar keeps to this part, so it never covers the heading or the tabs. -->
      <div class="weeks-list">
        <!-- A CSS grid with the roles of a keyboard grid: both seasons' rows lie in one place,
           so one can slide over the other below a header row that stays. The cells that are
           not shown, the other season's and on a phone the other apartments', are disabled,
           so the arrows pass them by. -->
        <div class="sheet">
          <div
            class="weeks-grid"
            ngGrid
            enableSelection
            selectionMode="explicit"
            [softDisabled]="false"
            rowWrap="nowrap"
            colWrap="nowrap"
            [attr.aria-label]="texts.nav.weeks"
            [style.--columns]="weeks.apartments.length + 1"
          >
            <div class="weeks-row weeks-columns" role="row" aria-rowindex="1">
              <span role="columnheader" aria-colindex="1">{{ texts.weeks.week }}</span>
              @for (apartment of weeks.apartments; track apartment.slug) {
                <span
                  role="columnheader"
                  [attr.aria-colindex]="$index + 2"
                  [class.elsewhere]="$index !== tab()"
                >
                  <span class="weeks-name">{{ apartment.name }}</span>
                  <small
                    >{{ guests(apartment) }} ·
                    <span aria-hidden="true">{{ size(apartment, 'shown') }}</span><span
                      class="sr-only"
                      >{{ size(apartment, 'spoken') }}</span
                    ></small
                  >
                </span>
              }
            </div>
            <div #panels class="weeks-bodies">
              @for (season of weeks.seasons; track season.name) {
                <div class="weeks-body" [attr.data-for]="season.name">
                  @if (season.state === 'open') {
                    @for (month of months(season); track month.key) {
                      <div class="weeks-month" role="rowgroup">
                        <span class="weeks-month-name" aria-hidden="true">{{ month.name }}</span>
                        @for (week of month.weeks; track week.arrival) {
                          <div class="weeks-row" ngGridRow [rowIndex]="week.row + 2">
                            @let span = days(week);
                            <span role="rowheader" aria-colindex="1"
                              ><span class="weekday">{{ span[0].weekday }}</span
                              >{{ span[0].date }} –
                              <span class="weekday">{{ span[1].weekday }}</span>{{
                                span[1].date
                              }}</span
                            >
                            @for (price of week.prices; track $index) {
                              <!-- A booked cell can be reached but not chosen: Enter, Space or
                                   a click on it would clear the chosen week. -->
                              <span
                                ngGridCell
                                role="gridcell"
                                [class]="price === null ? 'booked' : 'stay'"
                                [class.elsewhere]="$index !== tab()"
                                [colIndex]="$index + 2"
                                [disabled]="!shown(season.name, $index)"
                                [selectable]="price !== null"
                                [selected]="isChosen(season.name, $index, week.row)"
                                (selectedChange)="select($event, season.name, $index, week.row)"
                                [attr.aria-label]="describe(season, $index, week.row)"
                                [attr.data-pick]="$index + '-' + week.row"
                                (click)="price === null && $event.stopPropagation()"
                                (keydown.enter)="price === null && $event.stopPropagation()"
                                (keydown.space)="price === null && hold($event)"
                                (keydown.pageup)="byMonth($event, -1)"
                                (keydown.pagedown)="byMonth($event, 1)"
                              >
                                @if (price === null) {
                                  <span class="taken">{{ texts.weeks.taken }}</span>
                                } @else {
                                  <span class="price">{{ money(price) }}</span>
                                }
                              </span>
                            }
                          </div>
                        }
                      </div>
                    }
                  } @else {
                    <div class="weeks-month" role="rowgroup">
                      <div class="weeks-row" role="row">
                        <span class="weeks-empty" role="gridcell">
                          {{ fill(texts.weeks[season.state], { season: dated(season) }) }}
                        </span>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
        <p class="weeks-note">{{ note }}</p>
        <!-- One week at a time, in either season. The bar belongs to its season and is hidden
             while the other one is shown, so a change of season does not rebuild it. -->
        @if (picked(); as pick) {
          <div class="pick" [attr.data-for]="pick.season.name">
            <output>
              <span class="pick-name">{{ pick.name }}</span>
              <span class="pick-dot" aria-hidden="true"> · </span>
              <span>{{ pick.stay }} · {{ pick.price }}</span>
            </output>
            <div class="pick-actions">
              <button
                type="button"
                class="icon-button pick-clear"
                [attr.aria-label]="texts.weeks.clear"
                (click)="clear()"
              >
                <ng-icon name="lucideX" aria-hidden="true" />
              </button>
              <a class="button" [href]="pick.link">
                {{ texts.weeks.continue }}
              </a>
            </div>
          </div>
        }
      </div>
    } @else {
      <p class="text-ink-soft mt-6">{{ texts.weeks.unavailable }}</p>
    }
  `,
  host: { class: 'weeks' },
})
export class FreeWeeksList {
  readonly weeks = input.required<FreeWeeks | null>();

  protected readonly texts = inject(TEXTS);
  private readonly language = inject(LANGUAGE);
  private readonly season = inject(Season);
  protected readonly fill = fill;
  // On a phone the list shows one apartment, the one of the chosen tab.
  protected readonly tab = signal(0);
  protected readonly chosen = signal<{ season: SeasonName; apartment: number; row: number } | null>(
    null,
  );
  protected readonly picked = computed(() => {
    const pick = this.chosen();
    const season = pick && this.weeks()?.seasons.find(({ name }) => name === pick.season);
    if (!pick || !season) return null;
    const week = season.weeks[pick.row];
    return {
      season,
      name: this.weeks()!.apartments[pick.apartment].name,
      stay: this.stay(week),
      price: this.money(week.prices[pick.apartment]!),
      link: this.link(season, pick.apartment, pick.row),
    };
  });
  protected readonly announced = signal('');
  // From 48rem up every apartment has its column; below, only the chosen tab's is shown.
  private readonly wide = signal(true);
  private readonly panels = viewChild<ElementRef<HTMLElement>>('panels');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly dates = new Intl.DateTimeFormat(this.language.tag, {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  });
  private readonly spoken = new Intl.DateTimeFormat(this.language.tag, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  private readonly monthName = new Intl.DateTimeFormat(this.language.tag, {
    month: 'long',
    timeZone: 'UTC',
  });
  private readonly monthYear = new Intl.DateTimeFormat(this.language.tag, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  private readonly plural = new Intl.PluralRules(this.language.tag);
  // Set by the list's button: the next season comes from the right, the current from the left.
  private direction: 1 | -1 | 0 = 0;
  private moves: Animation[] = [];

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(this.season.watch((name) => this.move(name)));
    afterNextRender(() => {
      const query = matchMedia('(min-width: 48rem)');
      const update = () => this.wide.set(query.matches);
      update();
      query.addEventListener('change', update);
      destroyRef.onDestroy(() => query.removeEventListener('change', update));
    });
  }

  // The weeks by the month they arrive in; a week keeps its row in the season. The year is
  // named where the list starts and where a new one begins.
  protected months(season: SeasonWeeks) {
    const months: {
      key: string;
      name: string;
      weeks: (SeasonWeeks['weeks'][number] & { row: number })[];
    }[] = [];
    season.weeks.forEach((week, row) => {
      const key = week.arrival.slice(0, 7);
      if (months.at(-1)?.key !== key) {
        const date = new Date(week.arrival);
        const format = !months.length || date.getUTCMonth() === 0 ? this.monthYear : this.monthName;
        months.push({ key, name: format.format(date), weeks: [] });
      }
      months.at(-1)!.weeks.push({ ...week, row });
    });
    return months;
  }

  protected get note() {
    const { tax } = this.weeks()!;
    const { note, tax: taxes } = this.texts.weeks;
    return tax ? `${note} ${fill(taxes[tax.per], { amount: this.money(tax.amount) })}` : note;
  }

  // A site with one season has no dated seasons: its name stands alone.
  protected dated(season: SeasonWeeks) {
    const name = this.texts.seasons[season.name]!;
    return season.years ? `${name} ${season.years}` : name;
  }

  // The season the list's button leads to from the given one.
  protected other(name: SeasonName) {
    return this.weeks()!.seasons.find((season) => season.name !== name)!;
  }

  protected guests({ guests }: FreeWeeks['apartments'][number]) {
    const { one, other } = this.texts.weeks.guests;
    return fill(this.plural.select(guests) === 'one' ? one : other, { count: guests });
  }

  // A screen reader reads the unit's sign as it is written, "m superscript 2".
  protected size({ size }: FreeWeeks['apartments'][number], form: 'shown' | 'spoken') {
    return fill(this.texts.weeks.size[form], {
      size: new Intl.NumberFormat(this.language.tag).format(size),
    });
  }

  // A row's two days, each with its weekday apart, which the narrowest screens leave out.
  protected days({ arrival, departure }: { arrival: string; departure: string }) {
    return [arrival, departure].map((day) => {
      const parts = this.dates.formatToParts(new Date(day));
      const end = parts.findIndex(({ type }) => type === 'weekday') + 2;
      const text = (from: number, to?: number) =>
        parts
          .slice(from, to)
          .map(({ value }) => value)
          .join('');
      return { weekday: text(0, end), date: text(end) };
    });
  }

  // Not formatRange: across the turn of the year it adds both years.
  protected stay(
    { arrival, departure }: { arrival: string; departure: string },
    dates = this.dates,
  ) {
    return `${dates.format(new Date(arrival))} – ${dates.format(new Date(departure))}`;
  }

  protected money(amount: number) {
    const digits = Number.isInteger(amount) ? 0 : 2;
    return new Intl.NumberFormat(this.language.tag, {
      style: 'currency',
      currency: this.weeks()!.currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  }

  protected describe(season: SeasonWeeks, apartment: number, row: number) {
    const week = season.weeks[row];
    const { name } = this.weeks()!.apartments[apartment];
    const price = week.prices[apartment];
    return `${name} · ${this.stay(week, this.spoken)} · ${price === null ? this.texts.weeks.taken : this.money(price)}`;
  }

  protected link(season: SeasonWeeks, apartment: number, row: number) {
    const { arrival, departure } = season.weeks[row];
    const { slug } = this.weeks()!.apartments[apartment];
    const query = new URLSearchParams({ arrival, departure });
    return `${address(this.language, 'apartment', slug)}?${query}`;
  }

  protected isChosen(season: SeasonName, apartment: number, row: number) {
    const pick = this.chosen();
    return pick?.season === season && pick.apartment === apartment && pick.row === row;
  }

  // The grid chooses and clears: a click, Enter or Space on a week, again on the chosen one.
  protected select(selected: boolean, season: SeasonName, apartment: number, row: number) {
    if (selected) this.chosen.set({ season, apartment, row });
    else if (this.isChosen(season, apartment, row)) this.chosen.set(null);
  }

  protected shown(season: SeasonName, apartment: number) {
    return season === this.season.current() && (this.wide() || apartment === this.tab());
  }

  protected hold(event: Event) {
    event.stopPropagation();
    event.preventDefault();
  }

  // Page Up and Page Down: the same apartment's week in the month before or after, at the same
  // place in it as far as that month reaches.
  protected byMonth(event: Event, by: -1 | 1) {
    const cell = event.target as HTMLElement;
    const season = this.weeks()?.seasons.find(({ name }) => name === this.season.current());
    if (!season) return;
    event.preventDefault();
    const [apartment, row] = cell.dataset['pick']!.split('-').map(Number);
    const months = this.months(season);
    const from = months.findIndex(({ weeks }) => weeks.some((week) => week.row === row));
    const to = months[from + by];
    if (!to) return;
    const place = months[from].weeks.findIndex((week) => week.row === row);
    const target = to.weeks[Math.min(place, to.weeks.length - 1)].row;
    this.panels()
      ?.nativeElement.querySelector<HTMLElement>(
        `[data-for=${season.name}] [data-pick="${apartment}-${target}"]`,
      )
      ?.focus();
  }

  // The bar goes with its button, so the focus returns to the week that was chosen.
  protected clear() {
    const pick = this.chosen();
    this.chosen.set(null);
    this.panels()
      ?.nativeElement.querySelector<HTMLElement>(
        `[data-for=${pick?.season}] [data-pick="${pick?.apartment}-${pick?.row}"]`,
      )
      ?.focus();
  }

  protected pickTab(index: number) {
    this.tab.set(index);
    this.chosen.set(null);
  }

  protected slide() {
    const [first, second] = this.weeks()!.seasons;
    const to = this.season.current() === first.name ? second : first;
    this.direction = to === second ? 1 : -1;
    this.announced.set(`${this.texts.nav.weeks} ${this.dated(to)}`);
    this.season.switch(to.name);
  }

  // Before the change: the rows shown now and their height. After it, the old rows are held in
  // view while they leave.
  private move(to: SeasonName) {
    const direction = this.direction;
    this.direction = 0;
    const box = this.panels()?.nativeElement;
    const old = box?.querySelector<HTMLElement>(`[data-for=${this.season.current()}]`);
    const height = box?.offsetHeight;
    return () => {
      const next = box?.querySelector<HTMLElement>(`[data-for=${to}]`);
      this.moves.forEach((one) => one.cancel());
      box
        ?.querySelectorAll('[data-leaving]')
        .forEach((body) => body.removeAttribute('data-leaving'));
      if (!box || !old || !next || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      old.setAttribute('data-leaving', '');
      // The card grows while the rows move, and shrinks only after they have, so that the
      // leaving rows are not cut off.
      const before = height!;
      const after = next.offsetHeight;
      const duration = direction ? 450 : 600;
      const grows = after > before;
      const resize = Math.abs(after - before) < 1 ? 0 : grows ? duration : 250;
      const timing = (length: number, delay: number) => ({
        duration: length,
        delay,
        easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
        fill: 'both' as const,
      });
      // A whole width, the rows' grounds that reach the card's edges included.
      const width = box.offsetWidth;
      const rows = direction
        ? [
            old.animate({ translate: ['0', `${-direction * width}px 0`] }, timing(duration, 0)),
            next.animate({ translate: [`${direction * width}px 0`, '0'] }, timing(duration, 0)),
          ]
        : [
            old.animate({ opacity: [1, 0] }, timing(duration, 0)),
            next.animate({ opacity: [0, 1] }, timing(duration, 0)),
          ];
      const card = resize
        ? [
            box.animate(
              { height: [`${before}px`, `${after}px`] },
              timing(resize, grows ? 0 : duration),
            ),
          ]
        : [];
      this.moves = [...rows, ...card];
      // The leaving rows stay where their move ended until they are gone, which is as soon as
      // they have moved, not once the card has shrunk after them.
      const end = (parts: Animation[], then: () => void) =>
        Promise.all(parts.map((one) => one.finished)).then(
          () => {
            then();
            parts.forEach((one) => one.cancel());
          },
          // Cancelled by the next change, which starts from where things are.
          () => undefined,
        );
      end(rows, () => old.removeAttribute('data-leaving'));
      end(card, () => undefined);
      // A chosen week's bar returns with its season once the colours have changed: shown during
      // the change, Edge drew its button's label in white.
      const bar = this.host.nativeElement.querySelector<HTMLElement>(`.pick[data-for=${to}]`);
      bar?.animate({ opacity: [0, 1] }, { duration: 250, delay: 450, fill: 'backwards' });
    };
  }
}
