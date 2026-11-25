import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
  ViewEncapsulation,
  type Signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideBedDouble,
  lucideChevronDown,
  lucideClock,
  lucideFileBadge,
  lucideMapPin,
  lucideRuler,
  lucideScrollText,
  lucideUsers,
} from '@ng-icons/lucide';
import { HlmAccordionImports } from '@spartan-ng/helm/accordion';
import type { Listing } from '../beds24/client';
import { icons } from '../content/generated/icons';
import site from '../content/generated/site';
import { lucideName } from '../content/names';
import { BookingPanel } from './booking-panel';
import { Choice } from './choice';
import { Gallery } from './gallery';
import { LocationMap } from './location-map';
import { handover } from './map-handover';
import { address, fill, LANGUAGE, TEXTS } from './texts';

// A room or an area of amenities: its icon, its name and what it holds; a code shown alone has
// no items.
interface Entry {
  icon: string;
  name: string;
  items: string[];
}

// A block cut to a height until its button opens it, its full height measured for the motion.
const fold = () => ({ open: signal(false), long: signal(false), full: signal(0) });
type Fold = ReturnType<typeof fold>;

@Component({
  encapsulation: ViewEncapsulation.None,
  selector: 'app-apartment',
  imports: [NgIcon, HlmAccordionImports, BookingPanel, Gallery, LocationMap],
  providers: [
    provideIcons({
      ...icons,
      lucideArrowLeft,
      lucideBedDouble,
      lucideChevronDown,
      lucideClock,
      lucideFileBadge,
      lucideMapPin,
      lucideRuler,
      lucideScrollText,
      lucideUsers,
    }),
  ],
  template: `
    <div class="column apartment">
      <a class="back" [href]="choice.link(back)"
        ><ng-icon name="lucideArrowLeft" aria-hidden="true" />{{ texts.apartment.back }}</a
      >
      <h1 class="headline">{{ apartment.name }}</h1>
      <!-- The panel stands beside the main part from 64rem; below, it follows the amenities, and
           the main part's blocks are the grid's own. -->
      <div class="apartment-columns">
        <div class="apartment-main">
          @if (listing; as listing) {
            <ul class="facts">
              <li>
                <ng-icon name="lucideUsers" aria-hidden="true" />{{
                  fill(
                    texts.apartment.guests[
                      plural.select(listing.maxPeople) === 'one' ? 'one' : 'other'
                    ],
                    {
                      count: listing.maxPeople,
                    }
                  )
                }}
              </li>
              @if (listing.bedrooms; as bedrooms) {
                <li>
                  <ng-icon name="lucideBedDouble" aria-hidden="true" />{{
                    fill(
                      texts.apartment.bedrooms[plural.select(bedrooms) === 'one' ? 'one' : 'other'],
                      {
                        count: bedrooms,
                      }
                    )
                  }}
                </li>
              }
              <li>
                <ng-icon name="lucideRuler" aria-hidden="true" />{{
                  fill(texts.weeks.size.shown, { size: listing.size })
                }}
              </li>
              @if (listing.address) {
                <li>
                  <ng-icon name="lucideMapPin" aria-hidden="true" />
                  @if (hasMap) {
                    <a [href]="choice.link(mapLink)">{{ listing.address }}</a>
                  } @else {
                    {{ listing.address }}
                  }
                </li>
              }
              @if (listing.permit) {
                @let permit = texts.apartment.permit.split('{number}');
                <li>
                  <ng-icon name="lucideFileBadge" aria-hidden="true" /><span
                    >{{ permit[0]
                    }}<span class="inline-block max-w-full wrap-anywhere">{{ listing.permit }}</span
                    >{{ permit[1] }}</span
                  >
                </li>
              }
            </ul>
          }
          <app-gallery [pictures]="apartment.pictures" [plan]="apartment.plan" />
          @if (!listing) {
            <p class="text-ink-soft">{{ texts.apartment.unavailable }}</p>
          }
          @if (text.description) {
            <div>
              <div
                class="fold prose-fold"
                (focusin)="description.open.set(true)"
                [attr.data-open]="description.open() ? '' : null"
                [attr.data-long]="description.long() ? '' : null"
                [style.--full.px]="description.full()"
              >
                <div #prose id="description" class="prose" [innerHTML]="text.description"></div>
              </div>
              <button
                class="text-button"
                type="button"
                aria-controls="description"
                [attr.aria-expanded]="description.open()"
                [hidden]="!description.long()"
                (click)="description.open.set(!description.open())"
              >
                {{ texts.apartment.more }}<ng-icon name="lucideChevronDown" aria-hidden="true" />
              </button>
            </div>
          }
          @if (rooms.length) {
            <section>
              <h2>{{ texts.apartment.rooms }}</h2>
              <ul class="entries rooms">
                @for (room of rooms; track $index) {
                  <li>
                    <h3><ng-icon [name]="room.icon" aria-hidden="true" />{{ room.name }}</h3>
                    @if (room.items.length) {
                      <p>{{ room.items.join(', ') }}</p>
                    }
                  </li>
                }
              </ul>
            </section>
          }
          @if (amenities.entries.length) {
            <section>
              <h2>{{ texts.apartment.features }}</h2>
              <div
                class="fold amenities-fold"
                [attr.data-open]="amenities.fold.open() ? '' : null"
                [attr.data-long]="amenities.fold.long() ? '' : null"
                [style.--full.px]="amenities.fold.full()"
              >
                <ul #amenityList id="amenities" class="entries amenities">
                  @for (entry of amenities.entries; track entry.icon + entry.name) {
                    <li>
                      <h3><ng-icon [name]="entry.icon" aria-hidden="true" />{{ entry.name }}</h3>
                      @if (entry.items.length) {
                        <ul>
                          @for (item of entry.items; track item) {
                            <li>{{ item }}</li>
                          }
                        </ul>
                      }
                    </li>
                  }
                </ul>
              </div>
              <button
                class="text-button"
                type="button"
                aria-controls="amenities"
                [attr.aria-expanded]="amenities.fold.open()"
                [hidden]="!amenities.fold.long()"
                (click)="amenities.fold.open.set(!amenities.fold.open())"
              >
                {{ fill(texts.apartment.allFeatures, { count: amenities.total }) }}
                <ng-icon name="lucideChevronDown" aria-hidden="true" />
              </button>
            </section>
          }
        </div>
        <app-booking-panel />
        @if (checkIn || listing?.checkOut || text.houseRules || apartment.goodToKnow.length) {
          <section>
            <h2>{{ texts.apartment.goodToKnow }}</h2>
            <div hlmAccordion>
              @if (checkIn || listing?.checkOut) {
                <div hlmAccordionItem>
                  <hlm-accordion-trigger>
                    <ng-icon name="lucideClock" aria-hidden="true" /><span>{{
                      texts.apartment.times
                    }}</span>
                  </hlm-accordion-trigger>
                  <hlm-accordion-content>
                    <p>
                      @if (checkIn) {
                        {{ checkIn }}
                      }
                      @if (listing!.checkOut; as until) {
                        {{ fill(texts.apartment.checkOut, { until }) }}
                      }
                    </p>
                  </hlm-accordion-content>
                </div>
              }
              @if (text.houseRules) {
                <div hlmAccordionItem>
                  <hlm-accordion-trigger>
                    <ng-icon name="lucideScrollText" aria-hidden="true" /><span>{{
                      texts.apartment.houseRules
                    }}</span>
                  </hlm-accordion-trigger>
                  <hlm-accordion-content>
                    <p class="whitespace-pre-line">{{ text.houseRules }}</p>
                  </hlm-accordion-content>
                </div>
              }
              @for (note of notes(); track $index) {
                <div hlmAccordionItem>
                  <hlm-accordion-trigger>
                    <ng-icon [name]="note.icon" aria-hidden="true" /><span>{{ note.title }}</span>
                  </hlm-accordion-trigger>
                  <hlm-accordion-content>
                    <div class="prose" [innerHTML]="note.html"></div>
                  </hlm-accordion-content>
                </div>
              }
            </div>
          </section>
        }
      </div>
    </div>
    <!-- As on the home page: the map runs edge to edge, its heading stays in the column. -->
    @if (hasMap) {
      <section class="apartment-location">
        <h2 class="column" [id]="language.anchors.location">{{ texts.nav.location }}</h2>
        @defer (on viewport; when handover.drawn; hydrate on viewport) {
          <app-location-map [apartment]="apartment.slug" />
        } @placeholder {
          <div class="map-size"></div>
        }
      </section>
    }
  `,
  styles: `
    @layer components {
      /* The apartment page: from 64rem the pictures and the content on the left, the right column
         free for the booking panel. */
      /* A fold's text ends at the fold's padding, as the house rules do. */
      .spartan-accordion-content-inner .prose > :last-child {
        margin-bottom: 0;
      }

      .apartment {
        padding-top: 1rem;

        h1 {
          margin-top: 0.5rem;
        }
      }

      :is(.apartment, .apartment-location) {
        --size-heading: clamp(1.375rem, 1.2rem + 0.8vw, 1.75rem);

        h2 {
          margin-bottom: 1rem;
          font-size: var(--size-heading);
          font-weight: var(--font-weight-medium);
          letter-spacing: -0.01em;
        }
      }

      .apartment-location {
        padding-top: var(--space-section);
      }

      .back {
        font-size: 0.9375rem;
      }

      /* One column on a phone, which nothing may widen: the panel's rows do not break. */
      .apartment-columns {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 2rem;
        margin-top: 0.75rem;

        @media (min-width: 64rem) {
          grid-template-columns: minmax(0, 1fr) 24rem;
          column-gap: 3rem;

          > * {
            grid-column: 1;
          }

          > .booking {
            grid-column: 2;
            grid-row: 1 / span 2;
          }
        }
      }

      .apartment-main {
        display: contents;

        @media (min-width: 64rem) {
          display: grid;
          gap: 2rem;
        }
      }

      /* The facts stand close under the name, the gallery 1.5rem below them. */
      .facts + * {
        margin-top: -0.5rem;
      }

      /* A block cut to a height with a fade until its button opens it; the height moves to the
         content's measured one (--full). Without scripts there is no button, so nothing is cut. */
      .fold {
        /* Not hidden: a focused link below the cut would scroll the fold itself, not the page. */
        overflow: clip;
        /* Room for a focus ring inside the clip, with the content where it was: Safari has no
           overflow-clip-margin. Content-box keeps --cut and --full the content's heights. */
        --ring: 5px;
        box-sizing: content-box;
        margin: calc(-1 * var(--ring));
        padding: var(--ring);
        transition: max-height 0.4s cubic-bezier(0.16, 1, 0.3, 1);

        @media (scripting: enabled) {
          &:not([data-open]) {
            max-height: var(--cut, none);
          }
        }

        /* Only while it cuts: a fold that fits needs no limit, and one widened past its cut drops
           the old height at once instead of moving to the new one. */
        &[data-long][data-open] {
          max-height: var(--full);
        }

        &[data-long]:not([data-open]) {
          mask-image: linear-gradient(
            to bottom,
            #000 calc(100% - var(--ring) - 3rem),
            transparent calc(100% - var(--ring))
          );
        }

        @media (prefers-reduced-motion: reduce) {
          transition: none;
        }
      }

      /* About six lines of the description, on a phone only. */
      .prose-fold {
        @media (width < 48rem) {
          --cut: 10.5rem;
        }
      }

      /* On a phone only, for now: on a desktop the columns keep the list short. */
      .amenities-fold {
        @media (width < 48rem) {
          --cut: 13.5rem;
        }
      }

      /* A room or an area: its icon and name, and below them what it holds in the softer text. */
      .entries {
        h3 {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          font-weight: var(--font-weight-medium);
        }

        ng-icon {
          --ng-icon__size: 1.25rem;
          flex: none;
          --ng-icon__color: var(--color-ink-soft);
        }

        p,
        ul {
          padding-left: 1.875rem;
          color: var(--color-ink-soft);
          font-size: 0.9375rem;
          line-height: 1.6;
        }
      }

      .rooms {
        display: grid;
        /* Two columns from 22rem: at 320 px a name such as "Schlafzimmer 1" would break. */
        grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
        gap: 1rem;
      }

      /* Areas run in as many columns as there is room for, each kept whole. */
      .amenities {
        columns: 13rem;
        column-gap: 2rem;

        > li {
          break-inside: avoid;
          padding-bottom: 1rem;
        }

        /* On a phone an area's entries are one line, so the list stays short. */
        @media (width < 48rem) {
          li li {
            display: inline;
          }

          li li + li::before {
            content: ', ';
          }
        }
      }
    }
  `,
})
export class Apartment {
  protected readonly texts = inject(TEXTS);
  protected readonly language = inject(LANGUAGE);
  protected readonly fill = fill;
  private readonly route = inject(ActivatedRoute).snapshot;
  protected readonly apartment = site.apartments.find(
    ({ slug }) => slug === this.route.params['slug'],
  )!;
  protected readonly listing: Listing | null = this.route.data['listing'];
  protected readonly text = this.listing?.texts[this.language.code] ?? {
    description: '',
    houseRules: '',
  };
  protected readonly plural = new Intl.PluralRules(this.language.tag);
  // The arrival's wording by the bounds Beds24 sets.
  protected readonly checkIn = (() => {
    const { from, until } = this.listing?.checkIn ?? { from: null, until: null };
    const wording = this.texts.apartment.checkIn;
    const text = from && until ? wording.both : from ? wording.from : until ? wording.until : null;
    return text && fill(text, { from: from ?? '', until: until ?? '' });
  })();
  // The site's links in a fold carry the visitor's choice, as every link between the pages does.
  protected readonly notes = computed(() =>
    this.apartment.goodToKnow.map(({ icon, title, html }) => ({
      icon,
      title: title[this.language.code],
      html: html[this.language.code].replace(
        /href="(\/[^"]*)"/g,
        (_, href: string) =>
          `href="${this.choice.link(href.replaceAll('&amp;', '&')).replaceAll('&', '&amp;')}"`,
      ),
    })),
  );
  protected readonly back = `${address(this.language, 'home')}#${this.language.anchors.apartments}`;
  protected readonly choice = inject(Choice);
  protected readonly hasMap = !!site.map;
  protected readonly handover = handover;
  protected readonly mapLink = `${address(this.language, 'apartment', this.apartment.slug)}#${this.language.anchors.location}`;

  private readonly labels = this.texts.amenities;
  private readonly groups = this.listing?.features ?? [];
  // Groups that open with a listed room's code, numbered where a room comes more than once.
  protected readonly rooms: Entry[] = this.groups.flatMap(([code, ...items], index, all) => {
    const room = site.rooms.find((one) => one.code === code);
    if (!room) return [];
    const same = all.filter(([other]) => other === code);
    const nth = all.slice(0, index + 1).filter(([other]) => other === code).length;
    return [
      {
        icon: lucideName(room.icon),
        name: this.labels.rooms[code] + (same.length > 1 ? ` ${nth}` : ''),
        items: items.flatMap((item) => this.labels.codes[item] ?? []),
      },
    ];
  });
  protected readonly amenities = (() => {
    // Every code counts, a room's fittings too: a site may list a bath tub as an amenity.
    const codes = new Set(this.groups.flat());
    const entries = site.amenities.flatMap((entry): Entry[] => {
      const icon = lucideName(entry.icon);
      if ('code' in entry)
        return codes.has(entry.code)
          ? [{ icon, name: this.labels.codes[entry.code], items: [] }]
          : [];
      const items = entry.codes
        .filter((code) => codes.has(code))
        .map((code) => this.labels.codes[code]);
      return items.length ? [{ icon, name: this.labels.areas[entry.area], items }] : [];
    });
    return {
      entries,
      total: entries.reduce((sum, { items }) => sum + (items.length || 1), 0),
      fold: fold(),
    };
  })();

  // A long description and a long list of amenities show their first lines until their buttons
  // open them; where they are cut is the stylesheet's (--cut).
  protected readonly description = fold();
  private readonly prose = viewChild<ElementRef<HTMLElement>>('prose');
  private readonly amenityList = viewChild<ElementRef<HTMLElement>>('amenityList');

  constructor() {
    this.measure(this.description, this.prose);
    this.measure(this.amenities.fold, this.amenityList);
  }

  // The fold's content is its only child. Long is measured against the cut (in rem, unset where
  // nothing is cut), also while open: a window widened past the cut drops the button. A bottom
  // margin with no text after it is opened with the rest but needs no button. The page's root is
  // observed too, since crossing a breakpoint may change neither box.
  private measure(fold: Fold, content: Signal<ElementRef<HTMLElement> | undefined>) {
    afterRenderEffect((onCleanup) => {
      const element = content()?.nativeElement;
      if (!element) return;
      const root = element.ownerDocument.documentElement;
      const observer = new ResizeObserver(() => {
        const cut = parseFloat(getComputedStyle(element.parentElement!).getPropertyValue('--cut'));
        const rem = parseFloat(getComputedStyle(root).fontSize);
        const nodes = [...element.childNodes].reverse();
        const last = nodes.find((node) => node instanceof Element || node.textContent!.trim());
        const margin =
          last instanceof Element ? parseFloat(getComputedStyle(last).marginBottom) : 0;
        fold.full.set(element.offsetHeight);
        fold.long.set(element.offsetHeight - margin > cut * rem + 1);
      });
      observer.observe(element);
      observer.observe(root);
      onCleanup(() => observer.disconnect());
    });
  }
}
