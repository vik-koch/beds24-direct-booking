import { afterRenderEffect, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
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
import type { Listing } from '../beds24/client';
import { icons } from '../content/generated/icons';
import site from '../content/generated/site';
import { lucideName } from '../content/names';
import { address, fill, LANGUAGE, TEXTS } from './texts';

// Each area shows this many entries until the button opens all of them.
const shown = 3;

// An area with its entries, or a code shown alone (items null).
interface Entry {
  icon: string;
  name: string;
  items: string[] | null;
}

@Component({
  selector: 'app-apartment',
  imports: [NgIcon],
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
              fill(texts.apartment.guests, { count: listing.maxPeople })
            }}
          </li>
          @if (bedrooms) {
            <li>
              <ng-icon name="lucideBedDouble" aria-hidden="true" />{{
                fill(texts.apartment.bedrooms[bedrooms === 1 ? 'one' : 'other'], {
                  count: bedrooms,
                })
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
              #prose
              id="description"
              class="prose"
              [attr.data-open]="open() ? '' : null"
              [attr.data-long]="long() ? '' : null"
              [innerHTML]="text.description"
            ></div>
            <button
              class="text-button more-text"
              type="button"
              aria-controls="description"
              [attr.aria-expanded]="open()"
              [hidden]="!long()"
              (click)="open.set(!open())"
            >
              {{ texts.apartment.more }}<ng-icon name="lucideChevronDown" aria-hidden="true" />
            </button>
          </section>
        }
        @if (rooms.length) {
          <section>
            <h2>{{ texts.apartment.rooms }}</h2>
            <ul class="rooms">
              @for (room of rooms; track $index) {
                <li>
                  <strong>{{ room.name }}</strong>
                  @if (room.items) {
                    <span>{{ room.items }}</span>
                  }
                </li>
              }
            </ul>
          </section>
        }
        @if (amenities.entries.length) {
          <section>
            <h2>{{ texts.apartment.features }}</h2>
            <div id="amenities" class="amenities">
              @for (entry of amenities.entries; track entry.icon + entry.name) {
                @if (entry.items) {
                  <div class="area">
                    <h3><ng-icon [name]="entry.icon" aria-hidden="true" />{{ entry.name }}</h3>
                    <ul>
                      @for (item of entry.items; track item; let i = $index) {
                        <li [hidden]="i >= shown && !allAmenities()">{{ item }}</li>
                      }
                    </ul>
                  </div>
                } @else {
                  <p class="area single">
                    <ng-icon [name]="entry.icon" aria-hidden="true" />{{ entry.name }}
                  </p>
                }
              }
            </div>
            @if (amenities.more) {
              <button
                class="text-button"
                type="button"
                aria-controls="amenities"
                [attr.aria-expanded]="allAmenities()"
                (click)="allAmenities.set(!allAmenities())"
              >
                {{ fill(texts.apartment.allFeatures, { count: amenities.total }) }}
                <ng-icon name="lucideChevronDown" aria-hidden="true" />
              </button>
            }
          </section>
        }
        @if (listing?.checkIn || listing?.checkOut || text.houseRules) {
          <section>
            <h2>{{ texts.apartment.goodToKnow }}</h2>
            <div class="disclosures">
              @if (listing!.checkIn || listing!.checkOut) {
                <details>
                  <summary>
                    <ng-icon name="lucideClock" aria-hidden="true" />{{ texts.apartment.times }}
                    <ng-icon name="lucideChevronDown" aria-hidden="true" />
                  </summary>
                  <p>
                    @if (listing!.checkIn; as checkIn) {
                      {{ fill(texts.apartment.checkIn, checkIn) }}
                    }
                    @if (listing!.checkOut; as until) {
                      {{ fill(texts.apartment.checkOut, { until }) }}
                    }
                  </p>
                </details>
              }
              @if (text.houseRules) {
                <details>
                  <summary>
                    <ng-icon name="lucideScrollText" aria-hidden="true" />{{
                      texts.apartment.houseRules
                    }}
                    <ng-icon name="lucideChevronDown" aria-hidden="true" />
                  </summary>
                  <p class="whitespace-pre-line">{{ text.houseRules }}</p>
                </details>
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
  protected readonly shown = shown;
  private readonly route = inject(ActivatedRoute).snapshot;
  protected readonly apartment = site.apartments.find(
    ({ slug }) => slug === this.route.params['slug'],
  )!;
  protected readonly listing: Listing | null = this.route.data['listing'];
  protected readonly text = this.listing?.texts[this.language.code] ?? {
    description: '',
    houseRules: '',
  };
  protected readonly back = `${address(this.language, 'home')}#${this.language.anchors.apartments}`;
  protected readonly picture = this.apartment.pictures[0];
  protected readonly srcset = this.picture.sources
    .map(({ url, width }) => `${url} ${width}w`)
    .join(', ');

  private readonly labels = this.texts.amenities;
  private readonly groups = this.listing?.features ?? [];
  protected readonly bedrooms = this.groups.filter(([code]) => code === 'BEDROOM').length;
  // Groups that open with a room's code, numbered where a room comes more than once.
  protected readonly rooms = this.groups
    .filter(([code]) => Object.hasOwn(this.labels.rooms, code))
    .map(([code, ...items], index, all) => {
      const same = all.filter(([other]) => other === code);
      const nth = all.slice(0, index + 1).filter(([other]) => other === code).length;
      return {
        name: this.labels.rooms[code] + (same.length > 1 ? ` ${nth}` : ''),
        items: items.flatMap((item) => this.labels.codes[item] ?? []).join(', '),
      };
    });
  protected readonly amenities = (() => {
    const codes = new Set(
      this.groups.filter(([code]) => !Object.hasOwn(this.labels.rooms, code)).flat(),
    );
    const entries = site.amenities.flatMap((entry): Entry[] => {
      const icon = lucideName(entry.icon);
      if ('code' in entry)
        return codes.has(entry.code)
          ? [{ icon, name: this.labels.codes[entry.code], items: null }]
          : [];
      const items = entry.codes
        .filter((code) => codes.has(code))
        .map((code) => this.labels.codes[code]);
      return items.length ? [{ icon, name: this.labels.areas[entry.area], items }] : [];
    });
    return {
      entries,
      total: entries.reduce((sum, { items }) => sum + (items?.length ?? 1), 0),
      more: entries.some(({ items }) => (items?.length ?? 0) > shown),
    };
  })();
  protected readonly allAmenities = signal(false);

  // On a phone a long description shows its first lines until the button opens it.
  protected readonly open = signal(false);
  protected readonly long = signal(false);
  private readonly prose = viewChild<ElementRef<HTMLElement>>('prose');

  constructor() {
    afterRenderEffect((onCleanup) => {
      const element = this.prose()?.nativeElement;
      if (!element) return;
      const observer = new ResizeObserver(() => {
        if (!this.open()) this.long.set(element.scrollHeight > element.clientHeight + 1);
      });
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });
  }
}
