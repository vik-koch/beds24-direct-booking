import {
  Component,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideArrowRight } from '@ng-icons/lucide';
import type { FreeWeeks } from '../beds24/weeks';
import type { SeasonName } from '../content/names';
import { Season } from './season';
import { address, fill, LANGUAGE, TEXTS } from './texts';

type SeasonWeeks = FreeWeeks['seasons'][number];

// Both seasons' lists are in the page and the page's season attribute shows one, as with the
// hero photos, so the first paint needs no script. A change of season slides the lists when it
// comes from the list's own button and cross-fades them when it comes from the header.
@Component({
  selector: 'app-free-weeks',
  imports: [NgIcon],
  providers: [provideIcons({ lucideArrowLeft, lucideArrowRight })],
  template: `
    <div class="weeks-head">
      <h2 class="headline" [id]="anchor">
        {{ texts.nav.weeks }}
        @for (season of weeks()?.seasons; track season.name) {
          @if (season.years) {
            <span class="weeks-season" [attr.data-for]="season.name">{{ dated(season) }}</span>
          }
        }
      </h2>
      @if (weeks()?.seasons?.length === 2) {
        <!-- One button whose label follows the season, so that it keeps the focus. -->
        <button type="button" class="other-season" (click)="slide()">
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
      <div #panels class="weeks-panels">
        @for (season of weeks.seasons; track season.name) {
          <div class="weeks-panel" [attr.data-for]="season.name">
            @if (season.state === 'open') {
              <div class="sheet">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{{ texts.weeks.week }}</th>
                      @for (apartment of weeks.apartments; track apartment.slug) {
                        <th scope="col" [class.elsewhere]="$index !== tab()">
                          {{ apartment.name }}
                          <small>{{ facts(apartment) }}</small>
                        </th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (week of season.weeks; track week.arrival; let row = $index) {
                      <tr>
                        <th scope="row">{{ stay(week) }}</th>
                        @for (price of week.prices; track $index) {
                          <td [class.elsewhere]="$index !== tab()">
                            @if (price === null) {
                              <span class="taken">{{ texts.weeks.taken }}</span>
                            } @else {
                              <label class="stay">
                                <input
                                  type="radio"
                                  [name]="'stay-' + season.name"
                                  [checked]="isChosen(season.name, $index, row)"
                                  [attr.aria-label]="describe(season, $index, row)"
                                  (change)="choose(season.name, $index, row)"
                                />
                                <span class="price">{{ money(price) }}</span>
                              </label>
                            }
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <p class="weeks-note">{{ note }}</p>
              @if (chosen()[season.name]; as pick) {
                <div class="pick">
                  <output>{{ describe(season, pick.apartment, pick.row) }}</output>
                  <a class="button" [href]="link(season, pick.apartment, pick.row)">
                    {{ texts.weeks.continue }}
                  </a>
                </div>
              }
            } @else {
              <p class="weeks-empty">
                {{ fill(texts.weeks[season.state], { season: dated(season) }) }}
              </p>
            }
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
  protected readonly anchor = this.language.anchors.weeks;
  protected readonly fill = fill;
  // On a phone the list shows one apartment, the one of the chosen tab.
  protected readonly tab = signal(0);
  protected readonly chosen = signal<
    Partial<Record<SeasonName, { apartment: number; row: number }>>
  >({});
  protected readonly announced = signal('');
  private readonly panels = viewChild<ElementRef<HTMLElement>>('panels');

  private readonly dates = new Intl.DateTimeFormat(this.language.tag, {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  });
  private readonly plural = new Intl.PluralRules(this.language.tag);
  // Set by the list's button: the next season comes from the right, the current from the left.
  private direction: 1 | -1 | 0 = 0;
  private moves: Animation[] = [];

  constructor() {
    let before = this.season.current();
    effect(() => {
      const now = this.season.current();
      if (now !== before) untracked(() => this.move(before, now));
      before = now;
    });
  }

  protected get note() {
    const { tax } = this.weeks()!;
    const { note, tax: taxes } = this.texts.weeks;
    return tax ? `${note} ${fill(taxes[tax.per], { amount: this.money(tax.amount) })}` : note;
  }

  protected dated(season: SeasonWeeks) {
    return `${this.texts.seasons[season.name]} ${season.years}`;
  }

  // The season the list's button leads to from the given one.
  protected other(name: SeasonName) {
    return this.weeks()!.seasons.find((season) => season.name !== name)!;
  }

  protected facts({ guests, size }: FreeWeeks['apartments'][number]) {
    const { one, other } = this.texts.weeks.guests;
    const count = fill(this.plural.select(guests) === 'one' ? one : other, { count: guests });
    return `${count} · ${new Intl.NumberFormat(this.language.tag).format(size)}\u00a0m²`;
  }

  protected stay({ arrival, departure }: { arrival: string; departure: string }) {
    // Not formatRange: across the turn of the year it adds both years.
    return `${this.dates.format(new Date(arrival))} – ${this.dates.format(new Date(departure))}`;
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
    return `${name} · ${this.stay(week)} · ${this.money(week.prices[apartment]!)}`;
  }

  protected link(season: SeasonWeeks, apartment: number, row: number) {
    const { arrival, departure } = season.weeks[row];
    const { slug } = this.weeks()!.apartments[apartment];
    const query = new URLSearchParams({ arrival, departure });
    return `${address(this.language, 'apartment', slug)}?${query}`;
  }

  protected isChosen(name: SeasonName, apartment: number, row: number) {
    const pick = this.chosen()[name];
    return pick?.apartment === apartment && pick.row === row;
  }

  protected choose(name: SeasonName, apartment: number, row: number) {
    this.chosen.update((chosen) => ({ ...chosen, [name]: { apartment, row } }));
  }

  protected pickTab(index: number) {
    this.tab.set(index);
    this.chosen.set({});
  }

  protected slide() {
    const [first, second] = this.weeks()!.seasons;
    const to = this.season.current() === first.name ? second : first;
    this.direction = to === second ? 1 : -1;
    this.announced.set(`${this.texts.nav.weeks} ${this.dated(to)}`);
    this.season.switch(to.name);
  }

  // The season's attribute has changed already; the old list is held in view while it leaves.
  private move(from: SeasonName, to: SeasonName) {
    const direction = this.direction;
    this.direction = 0;
    const box = this.panels()?.nativeElement;
    const old = box?.querySelector<HTMLElement>(`[data-for=${from}]`);
    const next = box?.querySelector<HTMLElement>(`[data-for=${to}]`);
    this.moves.forEach((one) => one.cancel());
    box
      ?.querySelectorAll('[data-leaving]')
      .forEach((panel) => panel.removeAttribute('data-leaving'));
    if (!box || !old || !next || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    old.setAttribute('data-leaving', '');
    box.setAttribute('data-moving', '');
    const timing = { duration: direction ? 450 : 600, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' };
    const moves = (this.moves = [
      ...(direction
        ? [
            old.animate({ translate: ['0', `${-direction * 100}% 0`] }, timing),
            next.animate({ translate: [`${direction * 100}% 0`, '0'] }, timing),
          ]
        : [old.animate({ opacity: [1, 0] }, timing), next.animate({ opacity: [0, 1] }, timing)]),
      // The page below follows the height smoothly instead of jumping at the end.
      box.animate({ height: [`${old.offsetHeight}px`, `${next.offsetHeight}px`] }, timing),
    ]);
    Promise.all(moves.map((one) => one.finished)).then(
      () => {
        old.removeAttribute('data-leaving');
        box.removeAttribute('data-moving');
      },
      // Cancelled by the next change, which starts from where things are.
      () => undefined,
    );
  }
}
