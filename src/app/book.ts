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
import type { Question } from '../beds24/questions';
import type { FreeWeeks } from '../beds24/weeks';
import site from '../content/generated/site';
import { placesOf, srcset } from '../content/names';
import { answerRules, blank, countries, guestFields, inputOf, type Answers } from './answers';
import { Choice, fits, seasonOf, taxLine } from './choice';
import { Files } from './files';
import { Season } from './season';
import { heading } from './shell';
import { addDays, address, fill, formatMoney, formatStay, isDay, LANGUAGE, TEXTS } from './texts';

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
        <div class="booking-step">
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
              @if (listed; as listed) {
                <ul class="facts">
                  @if (listed.bedrooms) {
                    <li>
                      <ng-icon name="lucideBedDouble" aria-hidden="true" />{{
                        count(texts.apartment.bedrooms, listed.bedrooms)
                      }}
                    </li>
                  }
                  <li>
                    <ng-icon name="lucideRuler" aria-hidden="true" />{{
                      fill(texts.weeks.size.shown, { size: listed.size })
                    }}
                  </li>
                </ul>
              }
              <dl class="total">
                <div>
                  <dt>{{ texts.panel.guests }}</dt>
                  <dd>{{ guests }}</dd>
                </div>
                <div>
                  <dt>{{ fill(texts.panel.week, { stay: week }) }}</dt>
                  <dd>{{ money(price) }}</dd>
                </div>
                @if (tax) {
                  <div>
                    <dt>{{ tax.text }}</dt>
                    <dd>{{ money(tax.amount) }}</dd>
                  </div>
                }
                <div class="sum">
                  <dt>{{ texts.panel.total }}</dt>
                  <dd>{{ money(price + (tax?.amount ?? 0)) }}</dd>
                </div>
              </dl>
            </div>
          </div>
          <form #element class="answers" method="post" [formRoot]="answers">
            <h2>{{ texts.book.details }}</h2>
            @for (question of questions; track question.key) {
              @let field = answers[question.key];
              @let id = 'answer-' + question.key;
              @let label = labelOf(question);
              @let error = field().errors()[0]?.message;
              @if (inputOf(question) === 'checkbox') {
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
              } @else if (inputOf(question) === 'radio') {
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
                <div hlmField>
                  <label hlmFieldLabel [for]="id">{{ label }}</label>
                  @switch (inputOf(question)) {
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
                        rows="3"
                        [id]="id"
                        [formField]="$any(field)"
                        [attr.aria-required]="question.required || null"
                      ></textarea>
                    }
                    @default {
                      @let icon = pickerIcons[inputOf(question)];
                      <div [class.spartan-control]="icon">
                        <input
                          hlmInput
                          class="w-full"
                          [id]="id"
                          [type]="inputOf(question)"
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
          </form>
        </div>
      }
    </div>
  `,
  styles: `
    @layer components {
      /* As on the apartment's page, the stay beside the form from 64rem, where it stays in view;
         on a phone it comes first. */
      .booking-step {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 2rem;
        margin-top: 1.5rem;

        @media (min-width: 64rem) {
          grid-template-columns: minmax(0, 1fr) 24rem;
          column-gap: 3rem;
          align-items: start;

          .summary {
            grid-column: 2;
            grid-row: 1;
            position: sticky;
            top: 5.5rem;
          }
        }
      }

      .summary {
        overflow: clip;
      }

      /* A banner on a phone, so that the form starts within the screen. */
      .summary-picture {
        aspect-ratio: 5 / 2;
        border-radius: 0;

        @media (min-width: 64rem) {
          aspect-ratio: 3 / 2;
        }
      }

      .summary-text {
        display: grid;
        gap: 1rem;
        padding: 1.25rem 1.25rem 1.5rem;

        h2 {
          margin: 0;
        }

        .facts {
          margin-top: -0.5rem;
          font-size: 0.9375rem;
        }
      }

      .answers {
        display: grid;
        gap: 1.25rem;
        max-width: 36rem;

        h2 {
          margin: 0;
        }

        .terms {
          margin-top: 0.5rem;
          color: var(--color-ink-soft);
        }

        .button.wide {
          margin-top: 0;
        }
      }

      .choice {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-height: var(--size-control-small);
      }
    }
  `,
})
export class Book {
  protected readonly texts = inject(TEXTS);
  protected readonly fill = fill;
  protected readonly inputOf = inputOf;
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
  protected readonly listed = this.weeks?.apartments[0];
  private readonly arrival = this.route.queryParamMap.get('arrival') ?? '';
  protected readonly week: string;
  protected readonly guests: string;
  protected readonly price: number;
  protected readonly tax: { text: string; amount: number } | null;
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
    this.tax = taxLine(
      this.texts,
      this.plural,
      (amount) => this.money(amount),
      this.weeks?.tax,
      limits,
      adults,
      children,
    );
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
