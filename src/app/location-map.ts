import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBanknote,
  lucideBeer,
  lucideBike,
  lucideBookOpen,
  lucideBus,
  lucideChevronDown,
  lucideChurch,
  lucideCoffee,
  lucideCroissant,
  lucideDroplet,
  lucideDumbbell,
  lucideFuel,
  lucideGift,
  lucideHouse,
  lucideInfo,
  lucideLandmark,
  lucideMail,
  lucideMinus,
  lucideMountain,
  lucidePill,
  lucidePlus,
  lucideSandwich,
  lucideScissors,
  lucideShirt,
  lucideShoppingCart,
  lucideSquareParking,
  lucideStethoscope,
  lucideStore,
  lucideToilet,
  lucideTrainFront,
  lucideTreePine,
  lucideUtensils,
  lucideWaves,
} from '@ng-icons/lucide';
import { layers, namedFlavor, type Flavor } from '@protomaps/basemaps';
import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  Map as MapLibre,
  StyleSpecification,
} from 'maplibre-gl';
import { icons } from '../content/generated/icons';
import lifts from '../content/generated/lifts';
import routes from '../content/generated/routes';
import site from '../content/generated/site';
import { lucideName } from '../content/names';
import type { Route } from '../content/schema';
import { Season } from './season';
import { LANGUAGE, TEXTS } from './texts';

const map = site.map!;
// The points of interest the map shows, by their kind in the tiles, each with its Lucide icon, in
// groups that each have a colour in the theme. A kind not listed, such as the town's other places
// to stay, is left out.
const groups: Record<string, Record<string, string>> = {
  food: {
    restaurant: lucideUtensils,
    fast_food: lucideSandwich,
    cafe: lucideCoffee,
    bakery: lucideCroissant,
    bar: lucideBeer,
    pub: lucideBeer,
  },
  shop: {
    supermarket: lucideShoppingCart,
    convenience: lucideStore,
    kiosk: lucideStore,
    clothes: lucideShirt,
    gift: lucideGift,
    books: lucideBookOpen,
    hairdresser: lucideScissors,
  },
  transport: {
    parking: lucideSquareParking,
    fuel: lucideFuel,
    bus_stop: lucideBus,
    station: lucideTrainFront,
    bicycle_rental: lucideBike,
  },
  service: {
    pharmacy: lucidePill,
    doctors: lucideStethoscope,
    atm: lucideBanknote,
    bank: lucideBanknote,
    post_office: lucideMail,
    information: lucideInfo,
    toilets: lucideToilet,
    drinking_water: lucideDroplet,
  },
  culture: {
    place_of_worship: lucideChurch,
    museum: lucideLandmark,
    townhall: lucideLandmark,
    swimming_pool: lucideWaves,
    water_park: lucideWaves,
    fitness_centre: lucideDumbbell,
    peak: lucideMountain,
  },
};
const kinds = Object.fromEntries(
  Object.entries(groups).flatMap(([group, icons]) =>
    Object.entries(icons).map(([kind, svg]) => [kind, { group, svg }]),
  ),
);
// What a guest looks for first shows two zooms before the tiles would show it.
const early = ['parking', 'atm', 'bus_stop', 'supermarket', 'pharmacy', 'information'];

// A Lucide icon as an image in a colour, at a size in pixels, its lines as wide as given in its 24
// units. An SVG drawn on a canvas needs its size in its own attributes.
async function lucide(svg: string, size: number, color: string, stroke: number) {
  const image = new Image();
  image.src = `data:image/svg+xml,${encodeURIComponent(
    svg
      .replace('<svg ', `<svg width="${size}" height="${size}" `)
      .replace('currentColor', color)
      .replace('var(--ng-icon__stroke-width, 2)', `${stroke}`),
  )}`;
  await image.decode();
  return image;
}

// The least zoom at which a view of this size stays inside the box: below it the map would show
// where it has no tiles. Web Mercator's world is 512 px wide at zoom 0.
const mercator = (lat: number) =>
  (1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) /
  2;
const fitting = (width: number, height: number) =>
  Math.log2(
    Math.max(
      width / (((map.box.east - map.box.west) / 360) * 512),
      height / ((mercator(map.box.south) - mercator(map.box.north)) * 512),
    ),
  );

// The three channels of a colour in the form normal() gives: #rrggbb, or rgba() with an alpha.
const channels = (color: string) =>
  color.startsWith('#')
    ? [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
    : color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number);
// Mixes two colours: 0 is a, 1 is b.
const mix = (a: string, b: string, t: number) => {
  const [x, y] = [channels(a), channels(b)];
  return `rgb(${x.map((n, i) => Math.round(n * (1 - t) + y[i]! * t)).join(', ')})`;
};

// Protomaps' light flavour in the theme's colours.
function flavor(c: (name: string) => string): Flavor {
  const [ground, road] = [c('ground'), c('surface')];
  // The land in the season's tint, the village on the page's ground; a wood is a shade darker,
  // with its trees.
  const green = c('accent-soft');
  // At least 3:1 against the land, a wood and the ground, as are the routes, the lifts and the pins'
  // outlines.
  const casing = mix(green, c('ink-soft'), 0.85);
  const water = c('water');
  return {
    ...namedFlavor('light'),
    background: green,
    earth: green,
    industrial: ground,
    school: ground,
    hospital: ground,
    park_a: green,
    park_b: green,
    wood_a: green,
    wood_b: green,
    scrub_a: green,
    scrub_b: green,
    pedestrian: mix(ground, c('oak'), 0.5),
    water,
    // Rivers' and lakes' names, on a halo in the water's colour: at least 4.5:1.
    ocean_label: mix(water, c('ink'), 0.8),
    buildings: mix(c('oak'), c('edge'), 0.2),
    other: casing,
    minor_service: road,
    minor_a: road,
    minor_b: road,
    link: road,
    major: road,
    highway: road,
    minor_casing: casing,
    minor_service_casing: casing,
    major_casing_early: casing,
    major_casing_late: casing,
    roads_label_minor: c('ink-soft'),
    roads_label_minor_halo: road,
    roads_label_major: c('ink-soft'),
    roads_label_major_halo: road,
    subplace_label: c('ink-soft'),
    subplace_label_halo: ground,
    city_label: c('ink'),
    city_label_halo: ground,
    address_label: c('ink-soft'),
    address_label_halo: ground,
    // The coarse land cover of lower zooms, in the same two tones as the land use above it.
    landcover: {
      grassland: green,
      barren: green,
      urban_area: ground,
      farmland: green,
      glacier: ground,
      scrub: green,
      forest: green,
    },
    regular: 'theme',
    bold: 'theme',
    italic: 'theme',
  };
}

@Component({
  selector: 'app-location-map',
  // Its styles reach the elements MapLibre adds, such as its attribution.
  encapsulation: ViewEncapsulation.None,
  imports: [NgIcon, NgTemplateOutlet],
  providers: [provideIcons({ ...icons, lucideChevronDown, lucideHouse, lucideMinus, lucidePlus })],
  template: `
    <div class="location-map" [attr.data-drawn]="drawn() ? '' : null">
      <div #panel class="map-panel">
        <fieldset>
          <legend class="label">{{ texts.from }}</legend>
          <div class="map-choices">
            @for (apartment of apartments; track apartment.slug) {
              <label>
                <input
                  type="radio"
                  name="map-apartment"
                  [checked]="chosen() === apartment.slug"
                  (click)="choose(apartment.slug)"
                />
                <span>{{ apartment.name }}</span>
              </label>
            }
          </div>
        </fieldset>
        <ul class="map-places">
          @for (place of defaults; track place.key) {
            <ng-container *ngTemplateOutlet="line; context: { $implicit: place }" />
          }
        </ul>
        @if (more.length) {
          <!-- Folded, the other places stay in the page, so that the list can grow to them. -->
          <div class="map-more" [attr.data-open]="all() ? '' : null">
            <ul id="map-more" class="map-places" [attr.inert]="all() ? null : ''">
              @for (place of more; track place.key) {
                <ng-container *ngTemplateOutlet="line; context: { $implicit: place }" />
              }
            </ul>
          </div>
          <button
            type="button"
            class="text-button map-unfold"
            aria-controls="map-more"
            [attr.aria-expanded]="all()"
            (click)="fold()"
          >
            {{ texts.more }}<ng-icon name="lucideChevronDown" aria-hidden="true" />
          </button>
        }
        <ng-template #line let-place>
          <li>
            <button
              type="button"
              class="map-line"
              [attr.aria-pressed]="place.key === picked()"
              (click)="pick(place.key)"
            >
              <ng-icon [name]="lucideName(place.icon)" aria-hidden="true" />
              <span class="map-place-name">
                <span class="min-w-0 font-medium hyphens-auto">{{
                  texts.places[place.key]!.name
                }}</span>
                @if (route(place.key); as route) {
                  <span class="text-ink-soft whitespace-nowrap tabular-nums">{{
                    distance(route)
                  }}</span>
                }
              </span>
              @if (texts.places[place.key]![season.current()]; as note) {
                <span class="text-ink-soft">{{ note }}</span>
              }
            </button>
          </li>
        </ng-template>
      </div>
      <!-- After the panel, so that the keyboard reaches the choices first, also on a phone, where
           the panel shows below the map. -->
      <div class="map-frame">
        <div #canvas class="map-canvas"></div>
        <div class="map-zoom">
          <button
            type="button"
            class="icon-button"
            [attr.aria-label]="texts.zoomIn"
            [disabled]="zoom() >= maxZoom"
            (click)="drawn()?.zoomIn()"
          >
            <ng-icon name="lucidePlus" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="icon-button"
            [attr.aria-label]="texts.zoomOut"
            [disabled]="zoom() <= minZoom()"
            (click)="drawn()?.zoomOut()"
          >
            <ng-icon name="lucideMinus" aria-hidden="true" />
          </button>
        </div>
      </div>
      <!-- The map takes these as its markers; until it is drawn they stay out of sight. -->
      @for (apartment of apartments; track apartment.slug) {
        <span
          #marker
          class="map-label"
          aria-hidden="true"
          data-anchor="left"
          [attr.data-lat]="apartment.lat"
          [attr.data-lon]="apartment.lon"
          (click)="choose(apartment.slug)"
          >{{ apartment.name }}</span
        >
      }
      @for (place of shown(); track place.key) {
        @if (label(place.key); as label) {
          <span
            #marker
            class="map-label"
            aria-hidden="true"
            data-anchor="left"
            [attr.data-lat]="place.lat"
            [attr.data-lon]="place.lon"
            (click)="pick(place.key)"
            >{{ label }}</span
          >
        }
      }
      @for (apartment of apartments; track apartment.slug) {
        <button
          #marker
          type="button"
          class="map-pin"
          [attr.aria-label]="apartment.name"
          [attr.data-lat]="apartment.lat"
          [attr.data-lon]="apartment.lon"
          [attr.aria-pressed]="chosen() === apartment.slug"
          (click)="choose(apartment.slug)"
        >
          <ng-icon name="lucideHouse" aria-hidden="true" />
        </button>
      }
      @for (place of shown(); track place.key) {
        <button
          #marker
          type="button"
          class="map-pin map-place"
          [attr.aria-label]="texts.places[place.key]!.name"
          [attr.data-lat]="place.lat"
          [attr.data-lon]="place.lon"
          [attr.aria-pressed]="place.key === picked()"
          (click)="pick(place.key)"
        >
          <ng-icon [name]="lucideName(place.icon)" aria-hidden="true" />
        </button>
      }
    </div>
  `,
  styles: `
    /* Outside the layers: MapLibre's own stylesheet, which is unlayered, takes the outline away. */
    .location-map :is(.maplibregl-ctrl-attrib-button, .maplibregl-canvas):focus-visible {
      outline: var(--focus-ring);
      outline-offset: -3px;
    }

    @layer components {
      /* On a phone the panel follows the map; from 48rem it lies over the map's left side. */
      .location-map {
        position: relative;
        display: flex;
        flex-direction: column;
        max-width: 120rem;
        margin-inline: auto;
      }

      /* On a phone a square, so that the panel below it starts within the screen. */
      .map-frame {
        position: relative;
        aspect-ratio: 1;
        background: var(--color-ground);

        @media (min-width: 48rem) {
          aspect-ratio: auto;
          height: clamp(28rem, 70svh, 48rem);
        }
      }

      /* Its own layers, such as the hint to zoom with Ctrl, stay under the panel. */
      .map-canvas {
        isolation: isolate;
      }

      /* MapLibre makes its container relative, outside the layers; a height keeps it filled. */
      .map-canvas {
        height: 100%;
      }

      /* A teardrop with its icon in the head, its tip on the place: the element is as tall as the
         head turned on its corner, 2.25rem times (1 + sqrt 2) / 2. */
      .map-pin {
        display: none;
        justify-items: center;
        width: 2.25rem;
        height: 2.75rem;
        padding-top: 0.5625rem;
        /* Over every label; a chosen pin over the others. */
        z-index: 1;
        color: var(--color-accent);
        cursor: pointer;
        --ng-icon__size: 1.125rem;
        --pin: var(--color-surface);
        /* A white pin's outline stands out from the map at 3:1; a filled one needs none. */
        --outline: var(--color-edge);

        &::before {
          content: '';
          position: absolute;
          inset: 0 0 auto;
          z-index: -1;
          height: 2.25rem;
          border-radius: 50% 50% 0;
          background: var(--pin);
          box-shadow:
            0 0 0 1.5px var(--outline),
            0.25rem 0.25rem 0.75rem -0.25rem rgb(39 50 58 / 0.45);
          rotate: 45deg;
          transition:
            background-color 0.2s,
            box-shadow 0.2s;
        }

        &:hover::before {
          box-shadow:
            0 0 0 1.5px var(--outline),
            0.375rem 0.375rem 1rem -0.25rem var(--color-ink);
        }

        &:focus-visible {
          outline: none;

          &::before {
            outline: var(--focus-ring);
            outline-offset: 3px;
          }
        }

        &[aria-pressed='true'] {
          z-index: 2;
          color: var(--color-on-accent);
          --pin: var(--color-accent);
          --outline: var(--pin);
        }

        [data-drawn] & {
          display: grid;
        }
      }

      /* The apartments in the accent, the places in ink. */
      .map-place {
        color: var(--color-ink);

        &[aria-pressed='true'] {
          color: var(--color-surface);
          --pin: var(--color-ink);
        }
      }

      /* Beside a pin's head: an apartment's name, the way to a place, a chosen place's name. */
      .map-label {
        display: none;
        padding: 0.125rem 0.5rem;
        border-radius: var(--radius-control);
        background: var(--color-surface);
        box-shadow: 0 0.25rem 0.75rem -0.25rem rgb(39 50 58 / 0.35);
        color: var(--color-ink);
        /* MapLibre sets its own font on the map; a label takes the theme's. */
        font-family: var(--font-sans);
        font-size: 0.8125rem;
        font-weight: 500;
        white-space: nowrap;
        cursor: pointer;

        [data-drawn] & {
          display: block;
        }
      }

      .map-panel {
        order: 1;
        display: grid;
        gap: 1rem;
        margin: 1rem 1rem 0;
        padding: 1.25rem;
        border-radius: var(--radius-card);
        background: var(--color-surface);
        box-shadow: var(--shadow-card);

        @media (min-width: 48rem) {
          position: absolute;
          /* Over the map and its controls. */
          z-index: 3;
          inset: 1.5rem auto auto 2rem;
          width: 21rem;
          max-height: calc(100% - 3rem);
          overflow-y: auto;
          margin: 0;
          padding: 1.5rem;
        }
      }

      /* Without the application the choice and the switch cannot work, so only the places show. */
      html:not([data-script]) .map-panel :is(fieldset, .map-unfold) {
        display: none;
      }

      .map-choices {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        /* The first name stands in line with the legend; its pill reaches into the padding. */
        margin: 0.5rem -0.75rem 0;

        span {
          display: grid;
          place-items: center;
          min-height: var(--size-control-small);
          padding: 0 0.75rem;
          border-radius: var(--radius-control);
        }
      }

      /* Folded, the other places take no room and the panel's gap above them is taken back. */
      .map-more {
        display: grid;
        grid-template-rows: 0fr;
        margin-top: -1rem;

        @media (prefers-reduced-motion: no-preference) {
          transition: grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        &[data-open] {
          grid-template-rows: 1fr;
        }

        /* Its first line's margin, not a padding, so that folded it takes no room at all. */
        > ul {
          min-height: 0;
          overflow: hidden;

          > :first-child {
            margin-top: 0.25rem;
          }
        }
      }

      /* The button's height leaves room above its text, so the panel's gap need not be whole. */
      .map-unfold {
        justify-self: center;
        margin-top: -0.625rem;
      }

      .map-zoom {
        position: absolute;
        /* Over the map's own layers. */
        z-index: 1;
        /* Level with the panel's top. */
        inset: 1.5rem 0.75rem auto auto;
        display: none;
        flex-direction: column;
        border-radius: var(--radius-control);
        background: var(--color-surface);
        box-shadow: 0 0.25rem 0.75rem -0.25rem rgb(39 50 58 / 0.35);

        [data-drawn] & {
          display: flex;
        }
      }

      /* A place's icon, its name with the distance at the end of the line, its text below. */
      .map-place-name {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .map-places {
        display: grid;
        gap: 0.25rem;
        /* The lines' hover reaches past the panel's padding less than it. */
        margin-inline: -0.75rem;
      }

      .map-line {
        display: grid;
        grid-template-columns: auto 1fr;
        column-gap: 0.75rem;
        width: 100%;
        padding: 0.5rem 0.75rem;
        border-radius: var(--radius-card);
        text-align: start;
        cursor: pointer;
        transition: background-color 0.2s;
        --ng-icon__color: var(--color-ink-soft);
        --ng-icon__size: 1.375rem;

        > :last-child:not(.map-place-name) {
          grid-column: 2;
        }

        @media (hover: hover) {
          &:hover {
            background: var(--color-ground);
          }
        }

        &[aria-pressed='true'] {
          background: var(--color-ground);
        }

        &:focus-visible {
          outline-offset: -2px;
        }
      }
    }
  `,
})
export class LocationMap {
  protected readonly texts = inject(TEXTS).map!;
  protected readonly season = inject(Season);
  private readonly language = inject(LANGUAGE);
  private readonly document = inject(DOCUMENT);
  private readonly canvas = viewChild.required<ElementRef<HTMLElement>>('canvas');
  private readonly markers = viewChildren<ElementRef<HTMLElement>>('marker');
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  protected readonly map = map;
  protected readonly apartments = site.apartments;
  protected readonly defaults = map.places.filter((place) => !place.more);
  protected readonly more = map.places.filter((place) => place.more);
  protected readonly maxZoom = 18;
  protected readonly minZoom = signal(0);
  protected readonly zoom = signal(0);
  protected readonly lucideName = lucideName;
  protected readonly chosen = signal<string | undefined>(undefined);
  protected readonly picked = signal<string | undefined>(undefined);
  protected readonly all = signal(false);
  protected readonly shown = computed(() => map.places.filter((p) => this.all() || !p.more));
  protected readonly drawn = signal<MapLibre | undefined>(undefined);
  private readonly injector = inject(Injector);

  constructor() {
    const destroyed = inject(DestroyRef);
    afterNextRender(async () => {
      const { LngLatBounds, Map, Marker, getVersion, setWorkerUrl } = await import('maplibre-gl');
      // Served beside the page's files; the version gives a new one a new address.
      setWorkerUrl(`/map/maplibre-gl-worker.mjs?v=${getVersion()}`);
      await new Promise((loaded) => {
        const link = Object.assign(this.document.createElement('link'), {
          rel: 'stylesheet',
          href: `/map/maplibre-gl.css?v=${getVersion()}`,
          onload: loaded,
        });
        this.document.head.append(link);
      });
      let drawn: MapLibre;
      try {
        drawn = new Map({
          container: this.canvas().nativeElement,
          style: this.style(),
          maxBounds: [map.box.west, map.box.south, map.box.east, map.box.north],
          maxZoom: this.maxZoom,
          maxPitch: 0,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          cooperativeGestures: true,
          attributionControl: { compact: true },
          locale: {
            'Map.Title': this.texts.label,
            'AttributionControl.ToggleAttribution': this.texts.attribution,
            'CooperativeGesturesHandler.WindowsHelpText': this.texts.gestures.windows,
            'CooperativeGesturesHandler.MacHelpText': this.texts.gestures.mac,
            'CooperativeGesturesHandler.MobileHelpText': this.texts.gestures.touch,
          },
        });
      } catch {
        // Without WebGL the panel stands alone.
        return;
      }
      const hold = () => {
        const { width, height } = this.canvas().nativeElement.getBoundingClientRect();
        drawn.setMinZoom(Math.min(fitting(width, height), 16));
        this.minZoom.set(drawn.getMinZoom());
      };
      hold();
      drawn.on('resize', hold);
      // The images the style names, drawn at twice their size when a tile first needs one: a
      // place's icon in its group's colour, 18 px, and a wood's trees, whose
      // two colours are in their name: they change with the season.
      drawn.setMissingStyleImageResolver(async (id) => {
        const [trees, wood, tree] = id.split('|');
        if (trees !== 'trees' && !(id in kinds)) return;
        const color = (name: string) =>
          getComputedStyle(this.document.documentElement)
            .getPropertyValue(`--color-${name}`)
            .trim();
        const size = trees === 'trees' ? 64 : 36;
        const canvas = Object.assign(this.document.createElement('canvas'), {
          width: size,
          height: size,
        });
        const context = canvas.getContext('2d')!;
        if (trees === 'trees') {
          context.fillStyle = wood!;
          context.fillRect(0, 0, size, size);
          const image = await lucide(lucideTreePine, 20, tree!, 2);
          context.drawImage(image, 6, 6);
          context.drawImage(image, 38, 38);
        } else {
          const icon = await lucide(kinds[id]!.svg, size, color(`poi-${kinds[id]!.group}`), 2.5);
          context.drawImage(icon, 0, 0);
        }
        if (!drawn.hasImage(id))
          drawn.addImage(id, context.getImageData(0, 0, size, size), { pixelRatio: 2 });
      });
      drawn.on('zoom', () => this.zoom.set(drawn.getZoom()));
      drawn.touchZoomRotate.disableRotation();
      drawn.keyboard.disableRotation();
      const markers = new globalThis.Map<HTMLElement, InstanceType<typeof Marker>>();
      // The pins and labels in the template become the markers. One that stays is kept: removing a
      // focused pin would take the keyboard's focus with it. A pin's tip stands on its place; a
      // label starts beside the pin's head.
      effect(
        () => {
          const elements = new Set(this.markers().map((marker) => marker.nativeElement));
          for (const [element, marker] of markers)
            if (!elements.has(element)) {
              marker.remove();
              markers.delete(element);
            }
          for (const element of elements) {
            if (markers.has(element)) continue;
            const label = element.dataset['anchor'] === 'left';
            markers.set(
              element,
              new Marker({
                element,
                anchor: label ? 'left' : 'bottom',
                offset: label ? [24, -26] : [0, 0],
              })
                .setLngLat([+element.dataset['lon']!, +element.dataset['lat']!])
                .addTo(drawn),
            );
          }
        },
        { injector: this.injector },
      );
      // The apartments and the places shown, or the chosen apartment's routes, beside the panel; a
      // chosen place alone, or its route. Folding the places leaves the view as it is.
      effect(
        () => {
          const picked = this.picked();
          const shown = untracked(this.shown).filter((p) => !picked || p.key === picked);
          const lines = routes.filter(
            (r) => r.apartment === this.chosen() && shown.some((p) => p.key === r.place),
          );
          const points: [number, number][] = lines.length
            ? lines.flatMap((route) => route.line)
            : [...(picked ? [] : this.apartments), ...shown].map(({ lon, lat }) => [lon!, lat!]);
          const bounds = points.reduce(
            (box, point) => box.extend(point),
            new LngLatBounds(points[0], points[0]),
          );
          const frame = this.canvas().nativeElement.getBoundingClientRect();
          const panel = this.panel().nativeElement.getBoundingClientRect();
          // From 48rem the panel lies over the map's left side, on a phone below it.
          const over = panel.top < frame.bottom;
          drawn.fitBounds(bounds, {
            padding: {
              top: 64,
              right: 96,
              bottom: 48,
              left: over ? panel.right - frame.left + 48 : 48,
            },
            // A lone place keeps a closer zoom the visitor has chosen.
            maxZoom: picked && !lines.length ? Math.max(16, untracked(this.zoom)) : 16,
            animate: !matchMedia('(prefers-reduced-motion: reduce)').matches && !!this.drawn(),
          });
        },
        { injector: this.injector },
      );
      drawn.on('load', () => {
        this.zoom.set(drawn.getZoom());
        this.drawn.set(drawn);
      });
      destroyed.onDestroy(() => drawn.remove());
    });
    effect(() => {
      this.chosen();
      this.picked();
      this.all();
      this.season.current();
      this.drawn()?.setStyle(this.style());
    });
  }

  protected route(place: string) {
    return routes.find((r) => r.apartment === this.chosen() && r.place === place);
  }

  // A second click on the chosen apartment or place clears the choice.
  protected choose(slug: string) {
    this.chosen.set(this.chosen() === slug ? undefined : slug);
  }

  protected pick(place: string) {
    this.picked.set(this.picked() === place ? undefined : place);
  }

  // A chosen place that folds away is chosen no more.
  protected fold() {
    if (this.all() && this.more.some((place) => place.key === this.picked()))
      this.picked.set(undefined);
    this.all.set(!this.all());
  }

  // Beside a place's pin: the way there, or its name once chosen.
  protected label(place: string) {
    const route = this.route(place);
    if (route) return this.distance(route);
    return place === this.picked() ? this.texts.places[place]!.name : undefined;
  }

  protected distance({ meters }: Route) {
    const [value, unit] = meters < 1000 ? [meters, 'meter'] : [meters / 1000, 'kilometer'];
    return new Intl.NumberFormat(this.language.tag, {
      style: 'unit',
      unit,
      maximumFractionDigits: 1,
    }).format(value);
  }

  // Only in the browser: the server's document has no canvas.
  private canvas2d?: CanvasRenderingContext2D;

  private style(): StyleSpecification {
    // Any colour a theme may write, such as white or hsl(), in a form MapLibre and mix() read: a
    // canvas gives it back as #rrggbb, or as rgba() when it has an alpha.
    const normal = (color: string) => {
      this.canvas2d ??= this.document.createElement('canvas').getContext('2d')!;
      this.canvas2d.fillStyle = color.trim();
      return String(this.canvas2d.fillStyle);
    };
    // A change of season fades the accents on <html>: the map takes the colours they fade to, and
    // fades as long, so that it changes with the page.
    const html = this.document.documentElement;
    const css = getComputedStyle(html);
    const fading = html
      .getAnimations()
      .filter((a): a is CSSTransition => a instanceof CSSTransition);
    const c = (name: string) => {
      const property = `--color-${name}`;
      const effect = fading.find((a) => a.transitionProperty === property)
        ?.effect as KeyframeEffect;
      return normal(
        String(effect?.getKeyframes().at(-1)?.[property] ?? css.getPropertyValue(property)),
      );
    };
    const shown = this.shown().map((place) => place.key);
    const lines = routes
      .filter((r) => r.apartment === this.chosen() && shown.includes(r.place))
      .map((route) => ({
        type: 'Feature' as const,
        properties: { picked: route.place === this.picked() },
        geometry: { type: 'LineString' as const, coordinates: route.line },
      }));
    // The points of interest are ours, each kind beside its icon; the tiles' least zoom for each
    // stays. One-way arrows, which only drivers need, are left out.
    const base = layers('town', flavor(c), { lang: this.language.code })
      .filter((layer) => layer.id !== 'roads_oneway')
      .map((layer): LayerSpecification => {
        // Paths and tracks are the trails' own layer.
        if (layer.id === 'roads_other' && layer.type === 'line')
          return {
            ...layer,
            filter: [
              ...(layer.filter as unknown[]),
              ['!in', 'kind_detail', 'path', 'track'],
            ] as FilterSpecification,
          };
        if (layer.type !== 'symbol') return layer;
        // A name along a line or over an area keeps its letters clear of what lies under it.
        const clear = { ...layer, paint: { ...layer.paint, 'text-halo-width': 2 } };
        return layer.id === 'pois'
          ? {
              ...clear,
              filter: [
                'all',
                ['in', ['get', 'kind'], ['literal', Object.keys(kinds)]],
                [
                  '>=',
                  ['zoom'],
                  ['-', ['get', 'min_zoom'], ['match', ['get', 'kind'], early, 2, 0]],
                ],
              ] as FilterSpecification,
              // Protomaps' font, size and name; the name's place is ours.
              layout: {
                'text-font': layer.layout!['text-font'],
                'text-size': layer.layout!['text-size'],
                'text-max-width': layer.layout!['text-max-width'],
                'text-justify': 'auto',
                'icon-image': ['get', 'kind'],
                // Beside, above or below its icon, wherever the name finds room.
                'text-variable-anchor-offset': [
                  'left',
                  [1.4, 0],
                  'right',
                  [-1.4, 0],
                  'top',
                  [0, 1.2],
                  'bottom',
                  [0, -1.2],
                ],
                // A bus stop's icon is enough: its name is the stop's, often a place's beside it.
                'text-field': [
                  'case',
                  ['==', ['get', 'kind'], 'bus_stop'],
                  '',
                  layer.layout!['text-field'] as ExpressionSpecification,
                ],
              },
              // Every kind's name in the soft ink: Protomaps leaves the kinds it does not group,
              // such as information, nearly as light as the ground.
              paint: {
                ...clear.paint,
                'text-color': c('ink-soft'),
                'text-halo-color': c('ground'),
              },
            }
          : clear;
      });
    // The village's houses and shops on the page's ground, under its parks.
    base.splice(
      base.findIndex((layer) => layer.id === 'landuse_park'),
      0,
      {
        id: 'village',
        type: 'fill',
        source: 'town',
        'source-layer': 'landuse',
        filter: ['in', ['get', 'kind'], ['literal', ['residential', 'commercial', 'retail']]],
        paint: { 'fill-color': c('ground') },
      },
    );
    // A wood's trees over its green.
    const wood = mix(c('accent-soft'), c('accent'), 0.1);
    base.splice(
      base.findIndex((layer) => layer.id === 'landuse_urban_green'),
      0,
      {
        id: 'woods',
        type: 'fill',
        source: 'town',
        'source-layer': 'landuse',
        filter: ['in', ['get', 'kind'], ['literal', ['forest', 'wood']]],
        paint: { 'fill-pattern': `trees|${wood}|${mix(wood, c('accent'), 0.25)}` },
      },
    );
    // Paths and tracks, dashed in the trails' colour as hiking maps draw them.
    base.splice(base.findIndex((layer) => layer.id === 'roads_other') + 1, 0, {
      id: 'trails',
      type: 'line',
      source: 'town',
      'source-layer': 'roads',
      filter: [
        'all',
        ['!has', 'is_tunnel'],
        ['!has', 'is_bridge'],
        ['in', 'kind_detail', 'path', 'track'],
      ] as FilterSpecification,
      paint: {
        'line-color': c('trail'),
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.75, 16, 1.25],
        'line-dasharray': [3, 1.5],
      },
    });
    // The lifts lie over the roads and under every label, their names along them.
    base.splice(
      base.findIndex((layer) => layer.id === 'address_label'),
      0,
      {
        id: 'lifts',
        type: 'line',
        source: 'lifts',
        paint: {
          'line-color': c('ink'),
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 1.5],
        },
      },
      // Short ticks across the line, as OpenStreetMap draws a lift's pylons.
      {
        id: 'lift-ticks',
        type: 'line',
        source: 'lifts',
        paint: {
          'line-color': c('ink'),
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 7],
          'line-dasharray': [0.2, 5],
        },
      },
      {
        id: 'lift-names',
        type: 'symbol',
        source: 'lifts',
        minzoom: 14,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          // Beside the line, not on it.
          'text-offset': [0, 1],
          'text-font': ['theme'],
          'text-size': 12,
        },
        paint: { 'text-color': c('ink'), 'text-halo-color': c('ground'), 'text-halo-width': 1.5 },
      },
    );
    return {
      version: 8,
      'font-faces': { theme: map.font },
      transition: { duration: Number(fading[0]?.effect?.getComputedTiming().duration ?? 0) },
      sources: {
        town: {
          type: 'vector',
          tiles: [`${location.origin}${map.tiles}/{z}/{x}/{y}.mvt`],
          minzoom: 12,
          maxzoom: 15,
          bounds: [map.box.west, map.box.south, map.box.east, map.box.north],
          attribution:
            // OpenStreetMap's licence asks for this credit and its link, the map's only link out.
            '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> · Protomaps',
        },
        routes: { type: 'geojson', data: { type: 'FeatureCollection', features: lines } },
        lifts: {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: lifts.map(({ name, line }) => ({
              type: 'Feature',
              properties: { name },
              geometry: { type: 'LineString', coordinates: line },
            })),
          },
        },
      },
      layers: [
        ...base,
        {
          id: 'route-casing',
          type: 'line',
          source: 'routes',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': c('surface'), 'line-width': 7 },
        },
        {
          id: 'route',
          type: 'line',
          source: 'routes',
          filter: ['!', ['get', 'picked']],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            // Beside a chosen place's route the others fade.
            // Faded no further than 3:1 against the ground.
            'line-color': this.picked() ? mix(c('accent'), c('surface'), 0.25) : c('accent'),
            'line-width': 3.5,
            'line-dasharray': [1, 1.6],
          },
        },
        {
          id: 'route-picked',
          type: 'line',
          source: 'routes',
          filter: ['get', 'picked'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': c('accent'), 'line-width': 4.5 },
        },
      ],
    };
  }
}
