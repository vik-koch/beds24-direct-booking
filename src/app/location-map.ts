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
  lucideBeef,
  lucideBeer,
  lucideBike,
  lucideBinoculars,
  lucideBookOpen,
  lucideBus,
  lucideCableCar,
  lucideCakeSlice,
  lucideCandy,
  lucideCarrot,
  lucideChevronDown,
  lucideChurch,
  lucideCigarette,
  lucideClapperboard,
  lucideCoffee,
  lucideCroissant,
  lucideDroplet,
  lucideDumbbell,
  lucideEgg,
  lucideFish,
  lucideFlagTriangleRight,
  lucideFuel,
  lucideGift,
  lucideGraduationCap,
  lucideHouse,
  lucideIceCreamCone,
  lucideInfo,
  lucideLandmark,
  lucideLibrary,
  lucideMail,
  lucideMilk,
  lucideMinus,
  lucideMountain,
  lucideMountainSnow,
  lucideNewspaper,
  lucidePill,
  lucidePlugZap,
  lucidePlus,
  lucideRecycle,
  lucideSandwich,
  lucideScissors,
  lucideShirt,
  lucideShoppingBasket,
  lucideShoppingCart,
  lucideSnowflake,
  lucideSquareParking,
  lucideStethoscope,
  lucideStore,
  lucideTent,
  lucideToilet,
  lucideToyBrick,
  lucideTrainFront,
  lucideTrash2,
  lucideTreePine,
  lucideTrophy,
  lucideUtensils,
  lucideWashingMachine,
  lucideWaves,
  lucideWine,
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
import { handover } from './map-handover';
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
    ice_cream: lucideIceCreamCone,
  },
  shop: {
    supermarket: lucideShoppingCart,
    convenience: lucideStore,
    kiosk: lucideStore,
    marketplace: lucideShoppingBasket,
    butcher: lucideBeef,
    cheese: lucideMilk,
    dairy: lucideMilk,
    deli: lucideSandwich,
    greengrocer: lucideCarrot,
    farm: lucideEgg,
    pastry: lucideCakeSlice,
    chocolate: lucideCandy,
    confectionery: lucideCandy,
    wine: lucideWine,
    alcohol: lucideWine,
    seafood: lucideFish,
    // Lucide has no ski: a snowy mountain for the shops that sell and rent them.
    sports: lucideMountainSnow,
    ski: lucideMountainSnow,
    ski_rental: lucideMountainSnow,
    bicycle: lucideBike,
    outdoor: lucideTent,
    tobacco: lucideCigarette,
    newsagent: lucideNewspaper,
    clothes: lucideShirt,
    gift: lucideGift,
    books: lucideBookOpen,
    hairdresser: lucideScissors,
  },
  transport: {
    parking: lucideSquareParking,
    fuel: lucideFuel,
    bus_stop: lucideBus,
    // Not the tiles': the ends of a gondola or a cable car, where guests board.
    lift_station: lucideCableCar,
    bus_station: lucideBus,
    charging_station: lucidePlugZap,
    station: lucideTrainFront,
    bicycle_rental: lucideBike,
  },
  service: {
    pharmacy: lucidePill,
    doctors: lucideStethoscope,
    dentist: lucideStethoscope,
    laundry: lucideWashingMachine,
    dry_cleaning: lucideWashingMachine,
    atm: lucideBanknote,
    bank: lucideBanknote,
    post_office: lucideMail,
    information: lucideInfo,
    toilets: lucideToilet,
    drinking_water: lucideDroplet,
    recycling: lucideRecycle,
    waste_disposal: lucideTrash2,
  },
  culture: {
    place_of_worship: lucideChurch,
    museum: lucideLandmark,
    townhall: lucideLandmark,
    swimming_pool: lucideWaves,
    water_park: lucideWaves,
    fitness_centre: lucideDumbbell,
    sports_centre: lucideTrophy,
    ice_rink: lucideSnowflake,
    ski_school: lucideGraduationCap,
    cinema: lucideClapperboard,
    library: lucideLibrary,
    viewpoint: lucideBinoculars,
    peak: lucideMountain,
    miniature_golf: lucideFlagTriangleRight,
    playground: lucideToyBrick,
  },
};
const kinds = Object.fromEntries(
  Object.entries(groups).flatMap(([group, icons]) =>
    Object.entries(icons).map(([kind, svg]) => [kind, { group, svg }]),
  ),
);
// A route from the apartment's point to the place's: the router's line starts and ends on the
// nearest way, which may be across a yard or a road.
const walk = ({ apartment, place, line }: Route): [number, number][] => {
  const [from, to] = [
    site.apartments.find(({ slug }) => slug === apartment)!,
    map.places.find(({ key }) => key === place)!,
  ];
  return [[from.lon!, from.lat!], ...line, [to.lon, to.lat]];
};
// What a guest looks for first shows two zooms before the tiles would show it; culture, the other
// services and bus stops one zoom after, so that food and shops lead.
const early = ['parking', 'atm', 'supermarket', 'pharmacy', 'information'];
const late = [
  ...Object.keys(groups['culture']!),
  ...Object.keys(groups['service']!),
  'bus_stop',
].filter((kind) => !early.includes(kind));
const iconZoom: ExpressionSpecification = [
  '+',
  ['get', 'min_zoom'],
  ['match', ['get', 'kind'], early, -2, late, 1, 0],
];
// MapLibre lays a dash pattern out at the tile's whole zoom and stretches it up to twice as long
// until the next: the routes' dashes shrink as much, in eighths, so that they keep their length.
const dashes = (zoom: number) => {
  const stretch = Math.round(2 ** (zoom % 1) * 8) / 8;
  return [1 / stretch, 1.6 / stretch];
};

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
// A colour's OKLCH lightness, chroma and hue, and a colour from them: unlike a mix, a tint keeps
// its lightness when its hue changes.
const oklch = (color: string) => {
  const [r, g, b] = channels(color).map((v) =>
    (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  const [l, m, s] = [
    0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
    0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
    0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
  ].map(Math.cbrt) as [number, number, number];
  const [a, z] = [
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
  return {
    lightness: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    chroma: Math.hypot(a, z),
    hue: Math.atan2(z, a),
  };
};
const tint = (lightness: number, chroma: number, hue: number) => {
  const [a, b] = [chroma * Math.cos(hue), chroma * Math.sin(hue)];
  const [l, m, s] = [
    lightness + 0.3963377774 * a + 0.2158037573 * b,
    lightness - 0.1055613458 * a - 0.0638541728 * b,
    lightness - 0.0894841775 * a - 1.291485548 * b,
  ].map((v) => v ** 3) as [number, number, number];
  return `rgb(${[
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
    .map((v) =>
      Math.round(
        255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)),
      ),
    )
    .join(', ')})`;
};

// Every colour the map draws, from the theme's. The land, its woods and their trees take the
// accent's hue a little below the ground's lightness, so the map stays as light as the page and the
// season shows in its tint alone. Outlines and lines keep 3:1 against the land, a wood and the
// ground; names 4.5:1.
function palette(c: (name: string) => string) {
  const [ground, accent, water] = [c('ground'), c('accent'), c('water')];
  const { lightness, chroma } = oklch(ground);
  const accentHue = oklch(accent).hue;
  const land = tint(lightness, chroma * 0.5, accentHue);
  const wood = tint(lightness - 0.03, chroma * 1.5, accentHue);
  return {
    ground,
    land,
    wood,
    tree: tint(lightness - 0.13, 0.035, accentHue),
    pitch: c('pitch'),
    building: mix(c('oak'), c('edge'), 0.15),
    pedestrian: mix(ground, c('oak'), 0.5),
    road: c('surface'),
    casing: mix(land, c('ink-soft'), 0.85),
    water,
    bank: mix(water, c('poi-transport'), 0.75),
    waterName: mix(water, c('ink'), 0.8),
    trail: c('trail'),
    footway: c('ink-soft'),
    cycleway: c('poi-transport'),
    ink: c('ink'),
    inkSoft: c('ink-soft'),
    route: accent,
    // Beside a chosen place's route the others fade, no further than 3:1 against the ground.
    faded: mix(accent, c('surface'), 0.25),
    routeCasing: c('surface'),
    poi: Object.fromEntries(Object.keys(groups).map((group) => [group, c(`poi-${group}`)])),
  };
}

// Protomaps' light flavour in the map's colours.
function flavor(p: ReturnType<typeof palette>): Flavor {
  const { ground, land, road, casing } = p;
  return {
    ...namedFlavor('light'),
    background: land,
    earth: land,
    industrial: ground,
    school: ground,
    hospital: ground,
    park_a: land,
    park_b: land,
    wood_a: land,
    wood_b: land,
    scrub_a: land,
    scrub_b: land,
    pedestrian: p.pedestrian,
    water: p.water,
    ocean_label: p.waterName,
    buildings: p.building,
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
    roads_label_minor: p.inkSoft,
    roads_label_minor_halo: road,
    roads_label_major: p.inkSoft,
    roads_label_major_halo: road,
    subplace_label: p.inkSoft,
    subplace_label_halo: ground,
    city_label: p.ink,
    city_label_halo: ground,
    address_label: p.inkSoft,
    address_label_halo: ground,
    // The coarse land cover of lower zooms, in the same two tones as the land use above it.
    landcover: {
      grassland: land,
      barren: land,
      urban_area: ground,
      farmland: land,
      glacier: ground,
      scrub: land,
      forest: land,
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
      <div class="map-frame" [class.map-far]="far()">
        <!-- Replaced by a map taken over, with its own element: no binding here. -->
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
          [attr.data-anchor]="apartment.mapLabel === 'left' ? 'right' : 'left'"
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

      /* The pins' heads, smaller when the map shows the whole town; at 1.5rem still the 24px a
         target needs. */
      .map-frame {
        --head: 1.75rem;

        @media (prefers-reduced-motion: no-preference) {
          transition: --head 0.2s ease-out;
        }

        &.map-far {
          --head: 1.5rem;
        }
      }

      /* A teardrop with its icon in the head, its tip on the place: the element is as tall as the
         head turned on its corner, (1 + sqrt 2) / 2 heads. */
      .map-pin {
        display: none;
        justify-items: center;
        width: var(--head);
        height: calc(var(--head) * 1.2071);
        padding-top: calc(var(--head) / 5);
        /* Over every label; a chosen pin over the others. */
        z-index: 1;
        color: var(--color-accent);
        cursor: pointer;
        --ng-icon__size: calc(var(--head) * 0.6);
        --pin: var(--color-surface);
        /* A white pin's outline stands out from the map at 3:1; a filled one needs none. */
        --outline: var(--color-accent);

        &::before {
          content: '';
          position: absolute;
          inset: 0 0 auto;
          z-index: -1;
          height: var(--head);
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
          /* Outlined in white, so that a chosen pin stands out from its route. */
          --outline: var(--color-surface);
        }

        [data-drawn] & {
          display: grid;
        }
      }

      /* The apartments in the accent, the places in ink. */
      .map-place {
        color: var(--color-ink);
        --outline: var(--color-ink);

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
        /* Its near edge beside the pin's head, level with its middle. */
        translate: calc(var(--head) * 0.67) calc(var(--head) * -0.71);

        &[data-anchor='right'] {
          translate: calc(var(--head) * -0.67) calc(var(--head) * -0.71);
        }

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
  // Smaller pins while the map shows the whole town; decided by the zoom a move ends at, as fitting
  // a view passes below 16 on its way from 16 to 16.
  protected readonly far = signal(false);
  protected readonly lucideName = lucideName;
  protected readonly chosen = signal(handover.chosen);
  protected readonly picked = signal(handover.picked);
  protected readonly all = signal(handover.all ?? false);
  protected readonly shown = computed(() => map.places.filter((p) => this.all() || !p.more));
  protected readonly drawn = signal<MapLibre | undefined>(undefined);
  private readonly injector = inject(Injector);

  constructor() {
    const destroyed = inject(DestroyRef);
    afterNextRender(async () => {
      destroyed.onDestroy(() =>
        Object.assign(handover, { chosen: this.chosen(), picked: this.picked(), all: this.all() }),
      );
      const { LngLatBounds, Map, Marker, getVersion, setWorkerUrl } = await import('maplibre-gl');
      const locale = {
        'Map.Title': this.texts.label,
        'AttributionControl.ToggleAttribution': this.texts.attribution,
        'CooperativeGesturesHandler.WindowsHelpText': this.texts.gestures.windows,
        'CooperativeGesturesHandler.MacHelpText': this.texts.gestures.mac,
        'CooperativeGesturesHandler.MobileHelpText': this.texts.gestures.touch,
      };
      // A map taken over keeps its view, until the next choice.
      let kept = handover.drawn;
      handover.drawn = undefined;
      let drawn: MapLibre;
      if (kept) {
        drawn = kept;
        this.canvas().nativeElement.replaceWith(drawn.getContainer());
        // MapLibre writes its texts as it makes its parts: they are written again.
        Object.assign(drawn._locale, locale);
        drawn.getCanvas().setAttribute('aria-label', locale['Map.Title']);
        const toggle = drawn.getContainer().querySelector('.maplibregl-ctrl-attrib-button');
        toggle?.setAttribute('title', locale['AttributionControl.ToggleAttribution']);
        toggle?.setAttribute('aria-label', locale['AttributionControl.ToggleAttribution']);
        drawn.cooperativeGestures.disable();
        drawn.cooperativeGestures.enable();
      } else {
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
            locale,
          });
        } catch {
          // Without WebGL the panel stands alone.
          return;
        }
      }
      const hold = () => {
        const { width, height } = drawn.getContainer().getBoundingClientRect();
        drawn.setMinZoom(Math.min(fitting(width, height), 16));
        this.minZoom.set(drawn.getMinZoom());
      };
      hold();
      // The images the style names, drawn at twice their size when a tile first needs one: a
      // place's icon in its group's colour filled white, 18 px, and a wood's trees, whose
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
          const image = await lucide(lucideTreePine, 20, tree!, 1);
          context.drawImage(image, 6, 6);
          context.drawImage(image, 38, 38);
        } else {
          // Filled in the surface's white, so that each icon reads as a shape, not lines: every
          // fill first, then every line, or a later shape's fill covers an earlier line.
          const svg = kinds[id]!.svg.replace(
            /(<svg[^>]*>)(.*)<\/svg>/,
            `$1<g fill="${color('surface')}" stroke="none">$2</g>$2</svg>`,
          );
          const icon = await lucide(svg, size, color(`poi-${kinds[id]!.group}`), 1.5);
          context.drawImage(icon, 0, 0);
        }
        if (!drawn.hasImage(id))
          drawn.addImage(id, context.getImageData(0, 0, size, size), { pixelRatio: 2 });
      });
      const listeners = [
        drawn.on('resize', hold),
        drawn.on('zoom', () => {
          this.zoom.set(drawn.getZoom());
          if (drawn.getLayer('route'))
            drawn.setPaintProperty('route', 'line-dasharray', dashes(drawn.getZoom()));
        }),
        drawn.on('zoomend', () => this.far.set(drawn.getZoom() < 16)),
      ];
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
            markers.set(
              element,
              new Marker({
                element,
                anchor: (element.dataset['anchor'] as 'left' | 'right' | undefined) ?? 'bottom',
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
          if (kept) return void (kept = undefined);
          const points: [number, number][] = lines.length
            ? lines.flatMap(walk)
            : [...(picked ? [] : this.apartments), ...shown].map(({ lon, lat }) => [lon!, lat!]);
          const bounds = points.reduce(
            (box, point) => box.extend(point),
            new LngLatBounds(points[0], points[0]),
          );
          const frame = drawn.getContainer().getBoundingClientRect();
          const panel = this.panel().nativeElement.getBoundingClientRect();
          // From 48rem the panel lies over the map's left side, on a phone below it.
          const over = panel.top < frame.bottom;
          const view = {
            padding: {
              top: 64,
              right: 96,
              bottom: 48,
              left: over ? panel.right - frame.left + 48 : 48,
            },
            // A chosen place's route as close as it fits, a short one too; a lone place keeps a
            // closer zoom the visitor has chosen.
            maxZoom: picked
              ? lines.length
                ? this.maxZoom
                : Math.max(16, untracked(this.zoom))
              : 16,
          };
          // The pins take the size of the zoom the map eases to as it starts.
          const zoom = drawn.cameraForBounds(bounds, view)?.zoom;
          if (zoom !== undefined) this.far.set(zoom < 16);
          drawn.fitBounds(bounds, {
            ...view,
            animate:
              !matchMedia('(prefers-reduced-motion: reduce)').matches && !!untracked(this.drawn),
          });
        },
        { injector: this.injector },
      );
      const ready = () => {
        this.zoom.set(drawn.getZoom());
        this.far.set(drawn.getZoom() < 16);
        this.drawn.set(drawn);
      };
      if (kept) ready();
      else drawn.once('load', ready);
      // A drawn map is left to the next one, without this page's pins and listeners.
      destroyed.onDestroy(() => {
        if (!this.drawn()) return drawn.remove();
        for (const marker of markers.values()) marker.remove();
        for (const listener of listeners) listener.unsubscribe();
        handover.drawn = drawn;
      });
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
        geometry: { type: 'LineString' as const, coordinates: walk(route) },
      }));
    // The tiles' own entry for a place a pin marks, and a station under one, give way to the pin:
    // whatever lies within a metre of it.
    const pinned = this.shown().map(({ lat, lon }) => {
      const [y, x] = [1 / 110540, 1 / (111320 * Math.cos((lat! * Math.PI) / 180))];
      return [
        [
          [lon! - x, lat! - y],
          [lon! + x, lat! - y],
          [lon! + x, lat! + y],
          [lon! - x, lat! + y],
          [lon! - x, lat! - y],
        ],
      ];
    });
    const unpinned: ExpressionSpecification[] = pinned.length
      ? [['!', ['within', { type: 'MultiPolygon', coordinates: pinned }]]]
      : [];
    const point = (coordinates: number[]) => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Point' as const, coordinates },
    });
    // The points of interest are ours, each kind beside its icon; the tiles' least zoom for each
    // stays. Paths are ours too. One-way arrows, which only drivers need, and roads under ground,
    // which no one finds from the map, are left out.
    const streets = ['living_street', 'pedestrian'];
    const p = palette(c);
    const base = layers('town', flavor(p), { lang: this.language.code })
      .filter((layer) => !/^roads_(oneway|tunnels_|other|bridges_other)/.test(layer.id))
      .map((layer): LayerSpecification => {
        // Streets that guests walk are as wide as a road, in the pedestrian areas' shade.
        if (layer.type === 'line' && /^roads_minor(_casing)?$/.test(layer.id))
          return {
            ...layer,
            filter: ['any', layer.filter, ['in', 'kind_detail', ...streets]] as FilterSpecification,
            ...(layer.id === 'roads_minor' && {
              paint: {
                ...layer.paint,
                'line-color': ['match', ['get', 'kind_detail'], streets, p.pedestrian, p.road],
              },
            }),
          };
        // Streams in a deeper blue than the water, as the lines along its banks.
        if (layer.id === 'water_stream')
          return {
            ...layer,
            paint: { ...layer.paint, 'line-color': p.bank },
          } as LayerSpecification;
        if (layer.type !== 'symbol') return layer;
        // A name along a line or over an area keeps its letters clear of what lies under it.
        const clear = { ...layer, paint: { ...layer.paint, 'text-halo-width': 2 } };
        // The quarters' names smaller than Protomaps draws them, so that they stay in the back.
        if (layer.id === 'places_subplace')
          return {
            ...clear,
            layout: {
              ...clear.layout,
              'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 16, 12, 18, 14],
            },
          };
        return layer.id === 'pois'
          ? {
              ...clear,
              filter: [
                'all',
                ['in', ['get', 'kind'], ['literal', Object.keys(kinds)]],
                ['>=', ['zoom'], iconZoom],
                ...unpinned,
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
                'text-color': p.inkSoft,
                'text-halo-color': p.ground,
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
        paint: { 'fill-color': p.ground },
      },
    );
    // Pitches and playgrounds in their green, whatever the season.
    base.splice(
      base.findIndex((layer) => layer.id === 'landuse_park'),
      0,
      {
        id: 'leisure',
        type: 'fill',
        source: 'town',
        'source-layer': 'landuse',
        filter: ['in', ['get', 'kind'], ['literal', ['pitch', 'playground', 'recreation_ground']]],
        paint: { 'fill-color': p.pitch },
      },
    );
    base.splice(base.findIndex((layer) => layer.id === 'water') + 1, 0, {
      id: 'water-edge',
      type: 'line',
      source: 'town',
      'source-layer': 'water',
      filter: ['==', '$type', 'Polygon'],
      paint: { 'line-color': p.bank, 'line-width': 1 },
    });
    // A wood's trees over its green.
    base.splice(
      base.findIndex((layer) => layer.id === 'landuse_urban_green'),
      0,
      {
        id: 'woods',
        type: 'fill',
        source: 'town',
        'source-layer': 'landuse',
        filter: ['in', ['get', 'kind'], ['literal', ['forest', 'wood']]],
        paint: { 'fill-pattern': `trees|${p.wood}|${p.tree}` },
      },
    );
    // Under the roads, as OpenStreetMap draws them: paths and tracks dashed in the trails' colour,
    // footways and steps dotted, cycleways dashed in the transport blue.
    const path = (id: string, details: string[], color: string, dashes: number[]) =>
      ({
        id,
        type: 'line',
        source: 'town',
        'source-layer': 'roads',
        filter: ['all', ['!has', 'is_tunnel'], ['in', 'kind_detail', ...details]],
        layout: { 'line-cap': dashes[0] ? 'butt' : 'round' },
        paint: {
          'line-color': color,
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 15, 0.75, 16, 1.25, 18, 2],
          'line-dasharray': dashes,
        },
      }) as LayerSpecification;
    base.splice(
      base.findIndex((layer) => layer.id === 'roads_minor_service_casing'),
      0,
      path('trails', ['path', 'track'], p.trail, [3, 1.5]),
      path('footways', ['footway', 'steps', 'corridor'], p.footway, [0, 2]),
      path('cycleways', ['cycleway'], p.cycleway, [3, 1.5]),
    );
    // Until its icon shows, a place is a dot in its group's colour.
    base.splice(
      base.findIndex((layer) => layer.id === 'pois'),
      0,
      {
        id: 'dots',
        type: 'circle',
        source: 'town',
        'source-layer': 'pois',
        filter: [
          'all',
          ['in', ['get', 'kind'], ['literal', Object.keys(kinds)]],
          ['<', ['zoom'], iconZoom],
          ...unpinned,
        ],
        paint: {
          'circle-radius': 2,
          // Grey while the whole town shows, in its group's colour closer in.
          'circle-color': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15.5,
            p.inkSoft,
            16.5,
            [
              'match',
              ['get', 'kind'],
              ...Object.entries(groups).flatMap(([group, icons]) => [
                Object.keys(icons),
                p.poi[group],
              ]),
              p.ink,
            ],
          ] as unknown as ExpressionSpecification,
        },
      },
    );
    // The lifts lie over the roads and under every label, their names along them. As
    // OpenStreetMap draws them, a gondola or a cable car in ink, a chair lift in soft ink and
    // thinner, both with ticks for their pylons, and a drag lift in soft ink, dashed.
    const main: ExpressionSpecification = [
      'in',
      ['get', 'kind'],
      ['literal', ['gondola', 'cable_car', 'mixed_lift']],
    ];
    const drag: FilterSpecification = [
      'in',
      ['get', 'kind'],
      ['literal', ['drag_lift', 't-bar', 'j-bar', 'platter', 'rope_tow']],
    ];
    const color: ExpressionSpecification = ['case', main, p.ink, p.inkSoft];
    base.splice(
      base.findIndex((layer) => layer.id === 'address_label'),
      0,
      {
        id: 'lifts',
        type: 'line',
        source: 'lifts',
        filter: ['!', drag],
        paint: {
          'line-color': color,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12,
            ['case', main, 1, 0.75],
            16,
            ['case', main, 1.5, 1],
          ],
        },
      },
      {
        id: 'drag-lifts',
        type: 'line',
        source: 'lifts',
        filter: drag,
        paint: {
          'line-color': p.inkSoft,
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.75, 16, 1],
          'line-dasharray': [4, 3],
        },
      },
      {
        id: 'lift-ticks',
        type: 'line',
        source: 'lifts',
        filter: ['!', drag],
        paint: {
          'line-color': color,
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
        paint: { 'text-color': color, 'text-halo-color': p.ground, 'text-halo-width': 1.5 },
      },
      {
        id: 'stations',
        type: 'symbol',
        source: 'stations',
        filter: ['all', ...unpinned],
        layout: { 'icon-image': 'lift_station' },
      },
    );
    const labels = base.findIndex((layer) => layer.type === 'symbol');
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
        // Both ends of the chosen place's route.
        ends: {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: routes
              .filter((r) => r.apartment === this.chosen() && r.place === this.picked())
              .map(walk)
              .flatMap((line) => [point(line[0]!), point(line.at(-1)!)]),
          },
        },
        stations: {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: lifts
              .filter(({ kind }) => kind === 'gondola' || kind === 'cable_car')
              .flatMap(({ line }) => [point(line[0]!), point(line.at(-1)!)]),
          },
        },
        lifts: {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: lifts.map(({ kind, name, line }) => ({
              type: 'Feature',
              properties: { kind, name },
              geometry: { type: 'LineString', coordinates: line },
            })),
          },
        },
      },
      // Under every name, so that a walk along a street leaves the street's name legible.
      layers: [
        ...base.slice(0, labels),
        {
          id: 'route-casing',
          type: 'line',
          source: 'routes',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': p.routeCasing, 'line-width': 7 },
        },
        {
          id: 'route',
          type: 'line',
          source: 'routes',
          filter: ['!', ['get', 'picked']],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': this.picked() ? p.faded : p.route,
            'line-width': 3.5,
            'line-dasharray': dashes(untracked(this.zoom)),
          },
        },
        {
          id: 'route-picked',
          type: 'line',
          source: 'routes',
          filter: ['get', 'picked'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': p.route, 'line-width': 4.5 },
        },
        // A white dot ringed in the accent under a pin's tip, where the line starts or ends.
        {
          id: 'route-ends',
          type: 'circle',
          source: 'ends',
          paint: {
            'circle-radius': 4,
            'circle-color': p.routeCasing,
            'circle-stroke-color': p.route,
            'circle-stroke-width': 2.5,
          },
        },
        ...base.slice(labels),
      ],
    };
  }
}
