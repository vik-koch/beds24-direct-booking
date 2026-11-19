import {
  afterRenderEffect,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
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
  lucideSparkles,
  lucideUsers,
} from '@ng-icons/lucide';
import { HlmAccordionImports } from '@spartan-ng/helm/accordion';
import type { Listing } from '../beds24/client';
import { icons } from '../content/generated/icons';
import site from '../content/generated/site';
import { lucideName } from '../content/names';
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
  selector: 'app-apartment',
  imports: [NgIcon, HlmAccordionImports],
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
      lucideSparkles,
      lucideUsers,
    }),
  ],
  template: `
    <div class="column apartment">
      <a class="back" [href]="back"
        ><ng-icon name="lucideArrowLeft" aria-hidden="true" />{{ texts.apartment.back }}</a
      >
      <h1 class="headline">{{ apartment.name }}</h1>
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
      <div class="apartment-columns">
        <div class="apartment-picture">
          <img
            [attr.srcset]="srcset"
            sizes="(min-width: 64rem) 41rem, 100vw"
            [src]="picture.sources.at(-1)!.url"
            [width]="picture.width"
            [height]="picture.height"
            [alt]="picture.alt[language.code]"
          />
          @if (picture.generated) {
            <span class="ai-label"
              ><ng-icon name="lucideSparkles" aria-hidden="true" />{{
                texts.apartment.generated
              }}</span
            >
          }
        </div>
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
  protected readonly picture = this.apartment.pictures[0];
  protected readonly srcset = this.picture.sources
    .map(({ url, width }) => `${url} ${width}w`)
    .join(', ');

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
  // nothing is cut), also while open: a window widened past the cut drops the button. The page's
  // root is observed too, since crossing a breakpoint may change neither box.
  private measure(fold: Fold, content: Signal<ElementRef<HTMLElement> | undefined>) {
    afterRenderEffect((onCleanup) => {
      const element = content()?.nativeElement;
      if (!element) return;
      const root = element.ownerDocument.documentElement;
      const observer = new ResizeObserver(() => {
        const cut = parseFloat(getComputedStyle(element.parentElement!).getPropertyValue('--cut'));
        const rem = parseFloat(getComputedStyle(root).fontSize);
        fold.full.set(element.offsetHeight);
        fold.long.set(element.offsetHeight > cut * rem + 1);
      });
      observer.observe(element);
      observer.observe(root);
      onCleanup(() => observer.disconnect());
    });
  }
}
