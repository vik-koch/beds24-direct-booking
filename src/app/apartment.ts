import {
  afterRenderEffect,
  Component,
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
import { Gallery } from './gallery';
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
  imports: [NgIcon, HlmAccordionImports, BookingPanel, Gallery],
  providers: [
    provideIcons({
      ...icons,
      lucideArrowLeft,
      lucideBedDouble,
      lucideChevronDown,
      lucideClock,
      lucideMapPin,
      lucideRuler,
      lucideScrollText,
      lucideUsers,
    }),
  ],
  template: `
    <div class="column apartment">
      <a class="back" [href]="back"
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
              @if (bedrooms) {
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
                <li><ng-icon name="lucideMapPin" aria-hidden="true" />{{ listing.address }}</li>
              }
            </ul>
          }
          <app-gallery [pictures]="apartment.pictures" />
          @if (!listing) {
            <p class="text-ink-soft">{{ texts.apartment.unavailable }}</p>
          }
          @if (text.description) {
            <section>
              <h2>{{ texts.apartment.description }}</h2>
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
            </section>
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
        @if (checkIn || listing?.checkOut || text.houseRules) {
          <section>
            <h2>{{ texts.apartment.goodToKnow }}</h2>
            <div hlmAccordion>
              @if (checkIn || listing!.checkOut) {
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
            </div>
          </section>
        }
      </div>
    </div>
  `,
  styles: `
    @layer components {
      /* The apartment page: from 64rem the pictures and the content on the left, the right column
         free for the booking panel. */
      .apartment {
        --size-heading: clamp(1.375rem, 1.2rem + 0.8vw, 1.75rem);
        padding-top: 1rem;

        h1 {
          margin-top: 0.5rem;
        }

        h2 {
          margin-bottom: 1rem;
          font-size: var(--size-heading);
          font-weight: 500;
          letter-spacing: -0.01em;
        }
      }

      .back {
        --air: 0.875rem;
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        min-height: var(--size-control);
        margin-inline: calc(-1 * var(--air));
        padding-inline: var(--air);
        border-radius: var(--radius-control);
        color: var(--color-accent);
        font-weight: 500;
        text-decoration: underline transparent;
        text-underline-offset: 0.3em;
        transition: text-decoration-color 0.2s;

        &:hover {
          text-decoration-color: currentColor;
        }
      }

      .facts {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem 1.5rem;
        font-weight: 500;

        li {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        ng-icon {
          color: var(--color-ink-soft);
        }
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

      .prose {
        /* Keeps its children's outer margins, so its height is all a fold has to open to. */
        display: flow-root;
        max-width: 40rem;

        h3 {
          margin: 1.25rem 0 0.375rem;
          font-size: 1.1875rem;
          font-weight: 500;

          &:first-child {
            margin-top: 0;
          }
        }

        p,
        ul,
        ol,
        blockquote {
          margin-bottom: 0.625rem;
        }

        ul,
        ol {
          padding-left: 1.25rem;
        }

        ul {
          list-style: disc;
        }

        ol {
          list-style: decimal;
        }

        blockquote {
          padding-left: 1rem;
          border-left: 2px solid var(--color-line);
        }

        hr {
          margin: 1rem 0;
          border-color: var(--color-line);
        }

        strong {
          font-weight: 600;
        }

        a {
          color: var(--color-accent);
          font-weight: 500;
        }
      }

      /* A text with an arrow that opens more; its focus ring is a pill with air at its sides. */
      .text-button {
        --air: 0.875rem;
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        min-height: var(--size-control);
        margin-inline: calc(-1 * var(--air));
        padding-inline: var(--air);
        border-radius: var(--radius-control);
        color: var(--color-accent);
        font-weight: 500;
        text-decoration: underline transparent;
        text-underline-offset: 0.3em;
        transition: text-decoration-color 0.2s;
        cursor: pointer;

        &:hover {
          text-decoration-color: currentColor;
        }

        ng-icon {
          @media (prefers-reduced-motion: no-preference) {
            transition: rotate 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          }
        }

        &[aria-expanded='true'] ng-icon {
          rotate: 180deg;
        }

        &[hidden] {
          display: none;
        }
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
          font-weight: 500;
        }

        ng-icon {
          --ng-icon__size: 1.25rem;
          flex: none;
          color: var(--color-ink-soft);
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
  protected readonly back = `${address(this.language, 'home')}#${this.language.anchors.apartments}`;

  private readonly labels = this.texts.amenities;
  private readonly groups = this.listing?.features ?? [];
  protected readonly bedrooms = this.groups.filter(([code]) => code === 'BEDROOM').length;
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
