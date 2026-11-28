import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { form, FormField, FormRoot, validate } from '@angular/forms/signals';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideBedDouble,
  lucideCalendar,
  lucideChevronDown,
  lucideClock,
  lucideRuler,
  lucideSparkles,
} from '@ng-icons/lucide';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmRadioGroupImports } from '@spartan-ng/helm/radio-group';
import { HlmTextarea } from '@spartan-ng/helm/textarea';
import type { Listing } from '../beds24/client';
import type { Question } from '../beds24/questions';
import type { FreeWeeks } from '../beds24/weeks';
import site from '../content/generated/site';
import { placesOf, srcset } from '../content/names';
import { answerRules, blank, countries, guestFields, inputOf, type Answers } from './answers';
import { Choice, fits, seasonOf, taxed, taxFor } from './choice';
import { Files } from './files';
import { Season } from './season';
import { heading } from './shell';
import { addDays, address, fill, formatMoney, isDay, LANGUAGE, TEXTS } from './texts';

const pairs = [
  ['firstName', 'lastName'],
  ['email', 'phone'],
  ['email', 'mobile'],
  ['phone', 'mobile'],
  ['postcode', 'city'],
];

// The booking step: the stay from the address, checked against the apartment's weeks and limits,
// and the form that asks what the property's booking questions in Beds24 ask (ADR 19).
@Component({
  selector: 'app-book',
  imports: [
    NgIcon,
    Files,
    FormRoot,
    FormField,
    HlmFieldImports,
    HlmInput,
    HlmTextarea,
    HlmCheckbox,
    HlmRadioGroupImports,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideBedDouble,
      lucideCalendar,
      lucideChevronDown,
      lucideClock,
      lucideRuler,
      lucideSparkles,
    }),
  ],
  template: `
    <div class="column apartment">
      <a class="back" [href]="choice.link(back)"
        ><ng-icon name="lucideArrowLeft" aria-hidden="true" />{{
          fill(texts.book.back, { apartment: name })
        }}</a
      >
      <h1 class="headline">{{ heading }}</h1>
      @if (problem) {
        <p class="text-ink-soft mt-6">{{ problem }}</p>
      } @else {
        <!-- One form for the answers and the summary, whose button sends it. -->
        <form #element class="booking-step" method="post" [formRoot]="answers">
          <div class="answers">
            <h2>{{ texts.book.details }}</h2>
            @for (question of questions; track question.key) {
              @let field = answers[question.key];
              @let id = 'answer-' + question.key;
              @let label = labelOf(question);
              @let error = field().errors()[0]?.message;
              @let kind = inputOf(question);
              @if (kind === 'checkbox') {
                <div hlmField orientation="horizontal">
                  <!-- Its error is on the box, which brain's checkbox does not link itself. -->
                  <hlm-checkbox
                    [inputId]="id"
                    [formField]="$any(field)"
                    [aria-describedby]="error ? id + '-error' : null"
                  />
                  <label hlmFieldLabel [for]="id">{{ label }}</label>
                  <hlm-field-error [id]="id + '-error'">{{ error }}</hlm-field-error>
                </div>
              } @else if (kind === 'radio') {
                <fieldset hlmField>
                  <legend hlmFieldLegend [id]="id + '-label'">{{ label }}</legend>
                  <div
                    hlmRadioGroup
                    [formField]="$any(field)"
                    [attr.aria-labelledby]="id + '-label'"
                  >
                    @for (choice of choicesOf(question); track $index) {
                      <label class="choice" [for]="id + '-' + $index">
                        <hlm-radio [value]="'' + $index" [inputId]="id + '-' + $index">
                          <hlm-radio-indicator indicator />
                        </hlm-radio>
                        {{ choice }}
                      </label>
                    }
                  </div>
                  <hlm-field-error [id]="id + '-error'">{{ error }}</hlm-field-error>
                </fieldset>
              } @else {
                <div hlmField [class.half]="halves.has(question.key) || kind in pickerIcons">
                  <label hlmFieldLabel [for]="id">{{ label }}</label>
                  @switch (kind) {
                    @case ('select') {
                      <div class="spartan-control">
                        <select
                          hlmInput
                          [id]="id"
                          [formField]="$any(field)"
                          [attr.autocomplete]="autocompleteOf(question)"
                          [attr.aria-required]="question.required || null"
                        >
                          <option value="">{{ texts.book.choose }}</option>
                          @for (choice of optionsOf(question); track choice.value) {
                            <option [value]="choice.value">{{ choice.text }}</option>
                          }
                        </select>
                        <ng-icon name="lucideChevronDown" aria-hidden="true" />
                      </div>
                    }
                    @case ('textarea') {
                      <textarea
                        hlmTextarea
                        [id]="id"
                        [formField]="$any(field)"
                        [attr.aria-required]="question.required || null"
                      ></textarea>
                    }
                    @default {
                      @let icon = pickerIcons[kind];
                      <div [class.spartan-control]="icon">
                        <input
                          hlmInput
                          class="w-full"
                          [id]="id"
                          [type]="kind"
                          [formField]="$any(field)"
                          [attr.autocomplete]="autocompleteOf(question)"
                          [attr.aria-required]="question.required || null"
                        />
                        @if (icon) {
                          <ng-icon [name]="icon" aria-hidden="true" />
                        }
                      </div>
                    }
                  }
                  <hlm-field-error [id]="id + '-error'">{{ error }}</hlm-field-error>
                </div>
              }
            }
          </div>
          <div class="summary">
            <div class="summary-picture">
              @for (shown of place; track $index) {
                @let picture = shown.picture;
                <img
                  class="season-picture"
                  [attr.data-for]="shown.season"
                  [appFiles]="{
                    sizes: '(min-width: 64rem) 24rem, 100vw',
                    srcset: srcset(picture),
                    src: picture.sources[0].url,
                  }"
                  [width]="picture.width"
                  [height]="picture.height"
                  [alt]="picture.alt[language.code]"
                  loading="lazy"
                />
                @if (picture.generated) {
                  <span class="ai-label season-picture" [attr.data-for]="shown.season"
                    ><ng-icon name="lucideSparkles" aria-hidden="true" />{{
                      texts.apartment.generated
                    }}</span
                  >
                }
              }
            </div>
            <div class="summary-text">
              <h2>{{ name }}</h2>
              @if (listing; as listing) {
                <ul class="facts">
                  @if (listing.bedrooms) {
                    <li>
                      <ng-icon name="lucideBedDouble" aria-hidden="true" />{{
                        count(texts.apartment.bedrooms, listing.bedrooms)
                      }}
                    </li>
                  }
                  <li>
                    <ng-icon name="lucideRuler" aria-hidden="true" />{{
                      fill(texts.weeks.size.shown, { size: listing.size })
                    }}
                  </li>
                </ul>
              }
              <dl class="dates">
                @for (end of ends; track end.label) {
                  <div>
                    <dt>{{ end.label }}</dt>
                    <dd>{{ end.day }}</dd>
                    @if (end.time) {
                      <dd class="time">{{ end.time }}</dd>
                    }
                  </div>
                }
                <div class="guests">
                  <dt>{{ texts.panel.guests }}</dt>
                  <dd>{{ guests }}</dd>
                </div>
              </dl>
              <dl class="total">
                <div>
                  <dt>{{ texts.book.rent }}</dt>
                  <dd>{{ money(price) }}</dd>
                </div>
                @if (tax !== null) {
                  <div>
                    <dt>{{ texts.book.tax }}</dt>
                    <dd>{{ money(tax) }}</dd>
                  </div>
                }
                <div class="sum">
                  <dt>{{ texts.panel.total }}</dt>
                  <dd>{{ money(price + (tax ?? 0)) }}</dd>
                </div>
              </dl>
              @let terms = texts.book.terms.text.split('{link}');
              <p class="terms">
                {{ terms[0]
                }}<a [href]="texts.book.terms.link.href">{{ texts.book.terms.link.text }}</a
                >{{ terms[1] }}
              </p>
              <!-- Enter in a field presses it too. -->
              <button type="submit" class="button wide" (click)="pressed.set(true)">
                {{ texts.book.submit }}
              </button>
            </div>
          </div>
        </form>
      }
    </div>
  `,
  // A field pressed with a pointer shows no focus ring, as a button does not; Tab brings it back.
  // Set at once, not on the next render, which would show the ring for a frame.
  host: {
    '(pointerdown)': '$any($event.currentTarget).toggleAttribute("data-pointer", true)',
    '(keydown.tab)': '$any($event.currentTarget).removeAttribute("data-pointer")',
    '(keydown.shift.tab)': '$any($event.currentTarget).removeAttribute("data-pointer")',
  },
  styles: `
    @layer components {
      /* As on the apartment's page, the summary beside the form from 64rem, where it stays in view
         if the screen is tall enough; below, it ends the form with its button. */
      .booking-step {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 2.5rem;
        margin-top: 1.5rem;

        @media (min-width: 64rem) {
          grid-template-columns: minmax(0, 1fr) 24rem;
          column-gap: 3rem;
          align-items: start;

          .summary {
            grid-column: 2;
            grid-row: 1;
          }

          @media (min-height: 52rem) {
            .summary {
              position: sticky;
              top: 5.5rem;
            }
          }
        }
      }

      /* Two fields share a row where they are a pair, or short, from 40rem, where the form's column
         is at least 29rem wide, also beside the summary. */
      .answers {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 1.25rem 1rem;
        max-width: 36rem;

        > * {
          grid-column: 1 / -1;
        }

        h2 {
          margin: 0;
        }

        @media (min-width: 40rem) {
          grid-template-columns: repeat(2, minmax(0, 1fr));

          > .half {
            grid-column: auto;
          }
        }
      }

      .choice {
        display: flex;
        gap: 0.75rem;
        min-height: var(--size-control-small);
      }

      .summary {
        overflow: clip;
      }

      .summary-picture {
        aspect-ratio: 5 / 2;
        border-radius: 0;
      }

      /* Spaced as the booking panel: its sections apart by a line, the total's first row as far
         below its line as the sum's is above it. */
      .summary-text {
        --inset: 1.25rem;
        padding: 1.5rem var(--inset);

        @media (min-width: 48rem) {
          --inset: 2rem;
          padding-block: 2rem;
        }

        h2 {
          margin: 0;
          line-height: 1.2;
        }

        .facts {
          margin-top: 0.5rem;
          font-size: 0.9375rem;
        }

        > :is(.dates, .total) {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--color-line);
        }

        > .total {
          padding-top: 0.375rem;
        }

        .terms {
          margin-top: 1rem;
          color: var(--color-ink-soft);
          font-size: 0.9375rem;
        }
      }

      /* Arrival and departure side by side, each its day and its hours; the guests below. */
      .dates {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem 1rem;
        font-size: 0.9375rem;

        dt,
        .time {
          color: var(--color-ink-soft);
        }

        dt + dd {
          font-weight: var(--font-weight-medium);
        }

        .guests {
          grid-column: 1 / -1;

          dd {
            font-weight: var(--font-weight-normal);
          }
        }
      }
    }
  `,
})
export class Book {
  protected readonly texts = inject(TEXTS);
  protected readonly fill = fill;
  protected readonly inputOf = inputOf;
  // A date and a time are short: each takes half a row.
  protected readonly pickerIcons: Record<string, string> = {
    date: 'lucideCalendar',
    time: 'lucideClock',
  };
  protected readonly language = inject(LANGUAGE);
  protected readonly srcset = srcset;
  protected readonly choice = inject(Choice);
  private readonly route = inject(ActivatedRoute).snapshot;
  protected readonly heading = heading(this.texts, this.route);
  private readonly slug: string = this.route.params['slug'];
  private readonly apartment = site.apartments.find(({ slug }) => slug === this.slug)!;
  protected readonly name = this.apartment.name;
  // The first place's pictures, of one season each where the gallery has two.
  protected readonly place = placesOf(this.apartment.pictures, inject(Season).names)[0];

  private readonly plural = new Intl.PluralRules(this.language.tag);
  // A count and its noun stay on one line.
  protected readonly count = (forms: { one: string; other: string }, count: number) =>
    fill(this.plural.select(count) === 'one' ? forms.one : forms.other, { count }).replaceAll(
      ' ',
      ' ',
    );

  private readonly weeks: FreeWeeks | null = this.route.data['weeks'];
  protected readonly questions: Question[] = this.route.data['questions'] ?? [];
  protected readonly listing: Listing | null = this.route.data['listing'];
  // Fields that share a row when Beds24 asks them one after the other.
  protected readonly halves = new Set(
    this.questions.flatMap((question, index) => {
      const next = this.questions[index + 1];
      return next && pairs.some(([a, b]) => question.key === a && next.key === b)
        ? [question.key, next.key]
        : [];
    }),
  );
  private readonly arrival = this.route.queryParamMap.get('arrival') ?? '';
  protected readonly ends: { label: string; day: string; time: string | null }[];
  protected readonly guests: string;
  protected readonly price: number;
  protected readonly tax: number | null;
  protected readonly problem: string | null;
  protected readonly back: string;

  private readonly element = viewChild<ElementRef<HTMLFormElement>>('element');
  protected readonly pressed = signal(false);
  private readonly countryNames = new Intl.DisplayNames(this.language.tag, { type: 'region' });
  protected readonly answers = form(
    signal<Answers>(blank(this.questions)),
    // The answers are checked once the button is pressed, then as the guest types. An error shown
    // on leaving a field would push the button down under a pointer pressing it, and the press
    // would be lost.
    (path) => {
      const rules = answerRules(this.questions, this.texts, this.language.code);
      for (const { key } of this.questions)
        validate(path[key], ({ value }) => {
          const message = this.pressed() && rules[key](value());
          return message ? { kind: 'answer', message } : null;
        });
    },
    {
      name: 'answers',
      submission: {
        // The server books the week and sends the guest on to pay (#349).
        action: async () => {
          this.element()!.nativeElement.submit();
          return undefined;
        },
        onInvalid: (answers) => answers().errorSummary()[0]?.fieldTree().focusBoundControl(),
      },
    },
  );

  constructor() {
    const limits = this.weeks?.capacities[this.slug];
    const [adults, children] = [this.choice.adults(), this.choice.children()];
    // Where the apartment asks for no children, they are guests like the adults.
    const plain = limits && !limits.asksChildren;
    this.guests = plain
      ? this.count(this.texts.weeks.guests, adults + children)
      : new Intl.ListFormat(this.language.tag).format([
          this.count(this.texts.panel.adults, adults),
          ...(children ? [this.count(this.texts.book.children, children)] : []),
        ]);
    const season = this.weeks && seasonOf(this.weeks, this.arrival);
    const valid = this.weeks ? !!season : isDay(this.arrival);
    this.price =
      season?.weeks.find(({ arrival }) => arrival === this.arrival)?.prices[0] ?? Number.NaN;
    this.tax =
      this.weeks?.tax && limits ? taxFor(this.weeks.tax, taxed(limits, adults, children)) : null;
    const dates = new Intl.DateTimeFormat(this.language.tag, {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const { from, until } = this.listing?.checkIn ?? { from: null, until: null };
    const times = this.texts.book.times;
    const checkOut = this.listing?.checkOut;
    this.ends = valid
      ? [
          {
            label: this.texts.book.arrival,
            day: dates.format(new Date(this.arrival)),
            time:
              from && until
                ? fill(times.both, { from, until })
                : from
                  ? fill(times.from, { from })
                  : until
                    ? fill(times.until, { until })
                    : null,
          },
          {
            label: this.texts.book.departure,
            day: dates.format(new Date(addDays(this.arrival, 7))),
            time: checkOut ? fill(times.until, { until: checkOut }) : null,
          },
        ]
      : [];
    // Without Beds24 the stay goes unchecked, and the form cannot be asked.
    this.problem = !valid
      ? this.texts.book.invalid
      : !this.weeks || !this.questions.length || !this.weeks.apartments[0].bookable
        ? this.texts.book.unavailable
        : Number.isNaN(this.price)
          ? this.texts.book.taken
          : limits && !fits(limits, adults, children)
            ? fill(this.texts.panel.small, {
                name: this.name,
                guests: this.count(this.texts.weeks.guests, limits.maxPeople),
              })
            : null;
    // The apartment's panel shows the week chosen, as blocked where it is no longer free.
    const page = address(this.language, 'apartment', this.slug);
    // Its season is the one shown when it is followed.
    this.back = `${page}${valid ? `?arrival=${this.arrival}` : ''}#booking`;
  }

  protected money(amount: number) {
    return formatMoney(this.language.tag, this.weeks!.currency, amount);
  }

  protected labelOf(question: Question) {
    const label =
      'type' in question
        ? question.label[this.language.code]
        : this.texts.book.fields[question.key].label;
    return question.required ? label : `${label} (${this.texts.book.optional})`;
  }

  protected autocompleteOf(question: Question) {
    return 'type' in question ? 'off' : guestFields[question.key].autocomplete;
  }

  protected choicesOf(question: Question) {
    return ('type' in question && question.choices?.[this.language.code]) || [];
  }

  // A choice's position, or a country's code by its name in the page's language.
  protected optionsOf(question: Question) {
    return 'type' in question
      ? this.choicesOf(question).map((text, index) => ({ value: String(index), text }))
      : countries
          .map((value) => ({ value, text: this.countryNames.of(value) ?? value }))
          .sort((a, b) => a.text.localeCompare(b.text, this.language.tag));
  }
}
