import { DOCUMENT } from '@angular/common';
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
  viewChild,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideHouse } from '@ng-icons/lucide';
import { layers, namedFlavor, type Flavor } from '@protomaps/basemaps';
import type {
  FilterSpecification,
  LayerSpecification,
  Map as MapLibre,
  StyleSpecification,
} from 'maplibre-gl';
import { icons } from '../content/generated/icons';
import routes from '../content/generated/routes';
import site from '../content/generated/site';
import { lucideName } from '../content/names';
import type { Route } from '../content/schema';
import { Season } from './season';
import { LANGUAGE, TEXTS } from './texts';

const map = site.map!;
// Points of interest the map leaves out: the town's other places to stay.
const lodging = ['hotel', 'guest_house', 'apartment', 'hostel', 'motel', 'chalet', 'camp_site'];

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
  const green = c('accent-soft');
  const casing = mix(ground, c('edge'), 0.35);
  const poi = c('ink-soft');
  return {
    ...namedFlavor('light'),
    background: ground,
    earth: ground,
    park_a: green,
    park_b: green,
    wood_a: green,
    wood_b: mix(green, c('accent'), 0.08),
    scrub_a: green,
    scrub_b: green,
    pedestrian: mix(ground, c('oak'), 0.5),
    water: mix(ground, c('accent'), 0.35),
    buildings: c('oak'),
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
    // Every kind of place in one soft ink, so that only our pins carry colour.
    pois: {
      blue: poi,
      green: poi,
      lapis: poi,
      pink: poi,
      red: poi,
      slategray: poi,
      tangerine: poi,
      turquoise: poi,
    },
    // The coarse land cover of lower zooms, in the same two tones as the land use above it.
    landcover: {
      grassland: green,
      barren: ground,
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
  // Its styles reach the elements MapLibre adds, such as its zoom buttons.
  encapsulation: ViewEncapsulation.None,
  imports: [NgIcon],
  providers: [provideIcons({ ...icons, lucideHouse })],
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
        @if (map.places.length > defaults) {
          <label class="map-switch">
            <input type="checkbox" role="switch" [checked]="all()" (change)="all.set(!all())" />
            <span class="map-switch-track" aria-hidden="true"></span>
            {{ texts.more }}
          </label>
        }
        <ul class="map-places">
          @for (place of shown(); track place.key) {
            <li>
              <ng-icon [name]="lucideName(place.icon)" aria-hidden="true" />
              <div class="map-place-name">
                <p class="font-medium">{{ texts.places[place.key]!.name }}</p>
                @if (route(place.key); as route) {
                  <p class="text-ink-soft tabular-nums">{{ distance(route) }}</p>
                }
              </div>
              @if (texts.places[place.key]![season.current()]; as note) {
                <p class="text-ink-soft">{{ note }}</p>
              }
            </li>
          }
        </ul>
      </div>
      <!-- After the panel, so that the keyboard reaches the choices first. -->
      <div #canvas class="map-canvas"></div>
      <!-- The map takes these as its markers; until it is drawn they stay out of sight. -->
      @for (apartment of apartments; track apartment.slug) {
        <button
          #pin
          type="button"
          class="map-pin"
          [attr.data-lat]="apartment.lat"
          [attr.data-lon]="apartment.lon"
          [attr.aria-pressed]="chosen() === apartment.slug"
          (click)="choose(apartment.slug)"
        >
          <ng-icon name="lucideHouse" aria-hidden="true" />{{ apartment.name }}
        </button>
      }
      @for (place of shown(); track place.key) {
        <span
          #pin
          class="map-pin map-place"
          aria-hidden="true"
          [attr.data-lat]="place.lat"
          [attr.data-lon]="place.lon"
          [title]="texts.places[place.key]!.name"
        >
          <ng-icon [name]="lucideName(place.icon)" />
          @if (route(place.key); as route) {
            {{ distance(route) }}
          }
        </span>
      }
    </div>
  `,
  styles: `
    /* Outside the layers: MapLibre's own stylesheet, which is unlayered, takes the outline away. */
    .location-map
      :is(
        .maplibregl-ctrl button,
        .maplibregl-ctrl-attrib-button,
        .maplibregl-canvas
      ):focus-visible {
      outline: var(--focus-ring);
      outline-offset: -3px;
    }

    @layer components {
      .location-map {
        position: relative;
        display: block;
        height: clamp(28rem, 70svh, 48rem);
        max-width: 120rem;
        margin-inline: auto;
        background: var(--color-ground);
      }

      /* Its own layers, such as the hint to zoom with Ctrl, stay under the panel. */
      .map-canvas {
        isolation: isolate;
      }

      /* MapLibre makes its container relative, outside the layers; a height keeps it filled. */
      .map-canvas {
        height: 100%;
      }

      .map-pin {
        display: none;
        align-items: center;
        gap: 0.375rem;
        min-height: var(--size-control-small);
        padding: 0 0.875rem 0 0.625rem;
        border-radius: var(--radius-control);
        background: var(--color-surface);
        box-shadow: 0 0.25rem 0.75rem -0.25rem rgb(39 50 58 / 0.35);
        color: var(--color-ink);
        /* MapLibre sets its own font on the map; a pin takes the theme's. */
        font-family: var(--font-sans);
        font-size: 0.875rem;
        font-weight: 500;
        white-space: nowrap;
        --ng-icon__size: 1.125rem;
        transition:
          background-color 0.2s,
          color 0.2s,
          box-shadow 0.2s;

        [data-drawn] & {
          display: inline-flex;
        }
      }

      button.map-pin {
        cursor: pointer;

        &:hover {
          box-shadow: 0 0.5rem 1.25rem -0.5rem var(--color-ink);
        }

        &:focus-visible {
          outline: var(--focus-ring);
          outline-offset: 3px;
        }

        &[aria-pressed='true'] {
          background: var(--color-ink);
          color: var(--color-surface);
        }
      }

      /* A place is its icon and, from a chosen apartment, the way there; the panel names it. */
      .map-place {
        justify-content: center;
        min-width: var(--size-control-small);
        padding: 0 0.5rem;
        background: var(--color-accent);
        color: var(--color-on-accent);
      }

      .map-panel {
        position: absolute;
        /* Over the map and its controls. */
        z-index: 3;
        /* Above the attribution's line. */
        inset: auto 0.75rem 2.5rem;
        display: grid;
        gap: 1rem;
        max-height: 45%;
        overflow-y: auto;
        padding: 1.25rem;
        border-radius: var(--radius-card);
        background: var(--color-surface);
        box-shadow: var(--shadow-card);

        @media (min-width: 48rem) {
          inset: 1.5rem auto auto 2rem;
          width: 21rem;
          max-height: calc(100% - 3rem);
          padding: 1.5rem;
        }
      }

      .map-choices {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.5rem;

        input {
          position: absolute;
          opacity: 0;
        }

        span {
          display: grid;
          place-items: center;
          min-height: var(--size-control-small);
          padding: 0 1rem;
          border: 1px solid var(--color-edge);
          border-radius: var(--radius-control);
          font-weight: 500;
          cursor: pointer;
          transition:
            background-color 0.2s,
            border-color 0.2s,
            color 0.2s;
        }

        :checked + span {
          border-color: var(--color-ink);
          background: var(--color-ink);
          color: var(--color-surface);
        }

        :focus-visible + span {
          outline: var(--focus-ring);
          outline-offset: 3px;
        }
      }

      .map-switch {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-height: var(--size-control-small);
        font-weight: 500;
        cursor: pointer;

        input {
          position: absolute;
          opacity: 0;
        }
      }

      .map-switch-track {
        position: relative;
        flex: none;
        width: 2.75rem;
        height: 1.5rem;
        border-radius: var(--radius-control);
        background: var(--color-edge);
        transition: background-color 0.2s;

        &::after {
          content: '';
          position: absolute;
          inset: 0.1875rem auto auto 0.1875rem;
          width: 1.125rem;
          height: 1.125rem;
          border-radius: 50%;
          background: var(--color-surface);
          transition: translate 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        :checked + & {
          background: var(--color-accent);

          &::after {
            translate: 1.25rem 0;
          }
        }

        :focus-visible + & {
          outline: var(--focus-ring);
          outline-offset: 3px;
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
        gap: 0.875rem;

        li {
          display: grid;
          grid-template-columns: auto 1fr;
          column-gap: 0.75rem;

          > p {
            grid-column: 2;
          }
          --ng-icon__color: var(--color-ink-soft);
          --ng-icon__size: 1.375rem;
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
  private readonly pins = viewChildren<ElementRef<HTMLElement>>('pin');
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  protected readonly map = map;
  protected readonly apartments = site.apartments;
  protected readonly defaults = map.places.filter((place) => !place.more).length;
  protected readonly lucideName = lucideName;
  protected readonly chosen = signal<string | undefined>(undefined);
  protected readonly all = signal(false);
  protected readonly shown = computed(() => map.places.filter((p) => this.all() || !p.more));
  protected readonly drawn = signal<MapLibre | undefined>(undefined);
  private readonly injector = inject(Injector);

  constructor() {
    const destroyed = inject(DestroyRef);
    afterNextRender(async () => {
      const { LngLatBounds, Map, Marker, NavigationControl, getVersion, setWorkerUrl } =
        await import('maplibre-gl');
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
          maxZoom: 18,
          maxPitch: 0,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          cooperativeGestures: true,
          attributionControl: { compact: true },
          locale: {
            'Map.Title': this.texts.label,
            'NavigationControl.ZoomIn': this.texts.zoomIn,
            'NavigationControl.ZoomOut': this.texts.zoomOut,
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
      };
      hold();
      drawn.on('resize', hold);
      drawn.touchZoomRotate.disableRotation();
      drawn.keyboard.disableRotation();
      drawn.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      const markers = new Set<InstanceType<typeof Marker>>();
      // The pins in the template become the markers, again whenever the places shown change.
      effect(
        () => {
          for (const marker of markers) marker.remove();
          markers.clear();
          for (const { nativeElement: element } of this.pins())
            markers.add(
              new Marker({ element })
                .setLngLat([+element.dataset['lon']!, +element.dataset['lat']!])
                .addTo(drawn),
            );
        },
        { injector: this.injector },
      );
      // The apartments and the places shown, or the chosen apartment's routes, beside the panel.
      effect(
        () => {
          const lines = routes.filter(
            (r) => r.apartment === this.chosen() && this.shown().some((p) => p.key === r.place),
          );
          const points: [number, number][] = lines.length
            ? lines.flatMap((route) => route.line)
            : [...this.apartments, ...this.shown()].map(({ lon, lat }) => [lon!, lat!]);
          const bounds = points.reduce(
            (box, point) => box.extend(point),
            new LngLatBounds(points[0], points[0]),
          );
          const frame = this.canvas().nativeElement.getBoundingClientRect();
          const panel = this.panel().nativeElement.getBoundingClientRect();
          // From 48rem the panel stands at the side, on a phone at the foot.
          const beside = panel.width < frame.width / 2;
          drawn.fitBounds(bounds, {
            padding: {
              top: 64,
              right: 96,
              bottom: beside ? 48 : frame.bottom - panel.top + 48,
              left: beside ? panel.right - frame.left + 48 : 48,
            },
            maxZoom: 16,
            animate: !matchMedia('(prefers-reduced-motion: reduce)').matches && !!this.drawn(),
          });
        },
        { injector: this.injector },
      );
      drawn.on('load', () => this.drawn.set(drawn));
      destroyed.onDestroy(() => drawn.remove());
    });
    effect(() => {
      this.chosen();
      this.all();
      this.season.current();
      this.drawn()?.setStyle(this.style());
    });
  }

  protected route(place: string) {
    return routes.find((r) => r.apartment === this.chosen() && r.place === place);
  }

  // A second click on the chosen apartment clears the choice.
  protected choose(slug: string) {
    this.chosen.set(this.chosen() === slug ? undefined : slug);
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
        properties: {},
        geometry: { type: 'LineString' as const, coordinates: route.line },
      }));
    const base = layers('town', flavor(c), { lang: this.language.code }).map(
      (layer): LayerSpecification =>
        layer.id === 'pois' && layer.type === 'symbol'
          ? {
              ...layer,
              filter: [
                'all',
                layer.filter!,
                ['!', ['in', ['get', 'kind'], ['literal', lodging]]],
              ] as FilterSpecification,
            }
          : layer,
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
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': c('accent'), 'line-width': 3.5, 'line-dasharray': [1, 1.6] },
        },
      ],
    };
  }
}
