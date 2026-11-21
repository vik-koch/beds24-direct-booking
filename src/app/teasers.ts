import { Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBedDouble,
  lucideInfo,
  lucideRuler,
  lucideSparkles,
  lucideUsers,
} from '@ng-icons/lucide';
import type { FreeWeeks } from '../beds24/weeks';
import site from '../content/generated/site';
import { placesOf, srcset } from '../content/names';
import { fits, Guests } from './guests';
import { Season } from './season';
import { address, fill, formatMoney, LANGUAGE, TEXTS } from './texts';

type SeasonWeeks = FreeWeeks['seasons'][number];

// One card per apartment of the content, each a single link to its page. Without Beds24's answer
// a card keeps its picture and name.
@Component({
  encapsulation: ViewEncapsulation.None,
  selector: 'app-teasers',
  imports: [NgIcon],
  providers: [
    provideIcons({ lucideBedDouble, lucideInfo, lucideRuler, lucideSparkles, lucideUsers }),
  ],
  template: `
    <ul class="teasers" [attr.data-count]="cards().length">
      @for (card of cards(); track card.slug) {
        <li class="teaser">
          <div class="teaser-picture">
            @for (shown of card.place; track $index) {
              @let picture = shown.picture;
              <img
                class="season-picture"
                [attr.data-for]="shown.season"
                [attr.srcset]="srcset(picture)"
                sizes="(min-width: 64rem) 32rem, (min-width: 40rem) 50vw, 100vw"
                [src]="picture.sources[0].url"
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
          <div class="teaser-text">
            <h3>
              <a [href]="card.link">{{ card.name }}</a>
            </h3>
            @if (card.facts; as facts) {
              @if (facts.headline[language.code]; as headline) {
                <p class="teaser-headline">{{ headline }}</p>
              }
              <ul class="facts teaser-facts">
                <li>
                  <ng-icon name="lucideUsers" aria-hidden="true" />{{
                    count('guests', facts.guests)
                  }}
                </li>
                @if (facts.bedrooms) {
                  <li>
                    <ng-icon name="lucideBedDouble" aria-hidden="true" />{{
                      count('bedrooms', facts.bedrooms)
                    }}
                  </li>
                }
                <li>
                  <ng-icon name="lucideRuler" aria-hidden="true" />{{
                    fill(texts.weeks.size.shown, { size: facts.size })
                  }}
                </li>
              </ul>
              <!-- Both seasons' lines in one place: a card keeps its height across a switch. -->
              @if (card.small) {
                <p class="teaser-price too-small">
                  <ng-icon name="lucideInfo" aria-hidden="true" />{{ card.small }}
                </p>
              } @else {
                <p class="teaser-price stack">
                  @for (season of weeks()!.seasons; track season.name) {
                    @let lowest = lowestOf(season, card.index);
                    <span [attr.data-for]="season.name">
                      @if (lowest !== null) {
                        {{ from[0] }}<strong>{{ money(lowest) }}</strong
                        >{{ from[1] }}
                      } @else {
                        {{
                          fill(
                            texts.weeks[
                              season.states[card.index] === 'notOpen' ? 'notOpenShort' : 'full'
                            ],
                            {
                              season: texts.seasons[season.name]!,
                            }
                          )
                        }}
                      }
                    </span>
                  }
                </p>
              }
            }
          </div>
        </li>
      }
    </ul>
  `,
  styles: `
    @layer components {
      /* A phone stacks the cards. From 40rem two or four stand in two columns, one or three as
         rows with the picture beside the text; from 64rem three stand in three columns. */
      .teasers {
        display: grid;
        gap: 2.5rem 2rem;
        margin-top: 1.5rem;

        @media (min-width: 40rem) {
          &:is([data-count='2'], [data-count='4']) {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          &:is([data-count='1'], [data-count='3']) .teaser {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            column-gap: 2rem;
          }
        }

        @media (min-width: 64rem) {
          &[data-count='3'] {
            grid-template-columns: repeat(3, minmax(0, 1fr));

            .teaser {
              grid-template-columns: minmax(0, 1fr);
            }
          }
        }
      }

      /* The name's link covers the whole card, so the card is one link with the name as its own. */
      .teaser {
        position: relative;
        display: grid;
        gap: 1rem;
        align-content: start;

        &:has(a:focus-visible) {
          outline: var(--focus-ring);
          outline-offset: 0.5rem;
          border-radius: var(--radius-card);
        }

        h3 a {
          text-decoration: none;
          outline: none;

          &::after {
            content: '';
            position: absolute;
            inset: 0;
          }
        }

        &:hover h3 a {
          color: var(--color-accent);
        }
      }

      .teaser-picture {
        aspect-ratio: 3 / 2;
      }

      .teaser h3 {
        font-size: 1.5rem;
        font-weight: 500;
        letter-spacing: -0.01em;
      }

      .teaser-headline {
        margin-top: 0.125rem;
        color: var(--color-ink-soft);
      }

      .teaser-facts {
        row-gap: 0.25rem;
        margin-top: 0.625rem;
      }

      .teaser-price {
        margin-top: 0.75rem;
      }
    }
  `,
})
export class Teasers {
  readonly weeks = input.required<FreeWeeks | null>();
  protected readonly texts = inject(TEXTS);
  protected readonly language = inject(LANGUAGE);
  protected readonly fill = fill;
  protected readonly from = this.texts.panel.from.split('{price}');
  private readonly plural = new Intl.PluralRules(this.language.tag);
  private readonly guests = inject(Guests);
  private readonly seasons = inject(Season).names;

  protected readonly srcset = srcset;
  protected readonly cards = computed(() => {
    const weeks = this.weeks();
    const listed = weeks?.apartments ?? [];
    const { adults, children } = this.guests;
    const count = adults() + children();
    const { one, other } = this.texts.weeks.guests;
    const small = fill(this.texts.weeks.smallFor, {
      guests: fill(this.plural.select(count) === 'one' ? one : other, { count }),
    });
    return site.apartments.map(({ slug, name, pictures }) => {
      const index = listed.findIndex((one) => one.slug === slug);
      const capacity = weeks?.capacities[slug];
      return {
        slug,
        name,
        index,
        // The first place's pictures, of one season each where the gallery has two.
        place: placesOf(pictures, this.seasons)[0],
        link: this.guests.link(address(this.language, 'apartment', slug)),
        facts: listed[index] ?? null,
        small: capacity && !fits(capacity, adults(), children()) ? small : null,
      };
    });
  });

  protected count(key: 'guests' | 'bedrooms', count: number) {
    const { one, other } = this.texts.apartment[key];
    return fill(this.plural.select(count) === 'one' ? one : other, { count });
  }

  protected lowestOf(season: SeasonWeeks, index: number) {
    const prices = season.weeks.flatMap(({ prices }) => prices[index] ?? []);
    return prices.length ? Math.min(...prices) : null;
  }

  protected money(amount: number) {
    return formatMoney(this.language.tag, this.weeks()!.currency, amount);
  }
}
