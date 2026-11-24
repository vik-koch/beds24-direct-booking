import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
  ViewEncapsulation,
  type OnInit,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight, lucideSparkles } from '@ng-icons/lucide';
import { seenIn, srcset, type Shown } from '../content/names';
import type { Plan } from '../content/schema';
import { Files } from './files';
import { Season } from './season';
import { fill, LANGUAGE, TEXTS } from './texts';

// The viewer's plan view: the plan and its rooms beside the chosen room's pictures. A room is
// chosen by its name among the radios, or on the plan, where its zone is a pointer's shortcut and
// its name shows where it fits inside it.
@Component({
  encapsulation: ViewEncapsulation.None,
  selector: 'app-plan-view',
  host: { class: 'viewer-plan', '(document:keydown)': 'key($event)' },
  imports: [Files, NgIcon],
  providers: [provideIcons({ lucideChevronLeft, lucideChevronRight, lucideSparkles })],
  template: `
    <div class="plan-side">
      <div class="plan-area">
        <div #planBox class="plan-box" [style.--ratio]="plan().viewBox[2] / plan().viewBox[3]">
          <img [appFiles]="{ src: plan().url }" [alt]="plan().alt[language.code]" />
          <svg [attr.viewBox]="plan().viewBox.join(' ')" aria-hidden="true">
            @for (zone of plan().zones; track zone.key) {
              <polygon
                [attr.points]="corners(zone)"
                [attr.data-chosen]="zone.key === chosen() ? '' : null"
                (click)="choose(zone.key)"
              />
            }
          </svg>
          @for (zone of plan().zones; track zone.key) {
            <span
              class="plan-label"
              aria-hidden="true"
              [attr.data-fits]="fits().includes(zone.key) ? '' : null"
              [attr.data-chosen]="zone.key === chosen() ? '' : null"
              [style.left.%]="((zone.label[0] - plan().viewBox[0]) / plan().viewBox[2]) * 100"
              [style.top.%]="((zone.label[1] - plan().viewBox[1]) / plan().viewBox[3]) * 100"
              >{{ zone.name[language.code] }}</span
            >
          }
        </div>
      </div>
      <div class="zone-choices" role="radiogroup" [attr.aria-label]="texts.gallery.zones">
        @for (zone of plan().zones; track zone.key) {
          <label>
            <input
              type="radio"
              name="gallery-zone"
              [checked]="zone.key === chosen()"
              (change)="choose(zone.key)"
            />
            <span>{{ zone.name[language.code] }}</span>
          </label>
        }
      </div>
    </div>
    <div class="plan-photo">
      <div class="plan-frame">
        @for (each of places()[shown()]; track $index) {
          <img
            class="season-picture"
            [attr.data-for]="each.season"
            [appFiles]="{
              sizes: '(min-width: 48rem) 50vw, 100vw',
              srcset: srcset(each.picture),
              src: each.picture.sources[0].url,
            }"
            [width]="each.picture.width"
            [height]="each.picture.height"
            alt=""
          />
        }
      </div>
      @if (zonePlaces().length > 1) {
        <div class="plan-steps">
          <button
            class="icon-button"
            type="button"
            [attr.aria-label]="texts.gallery.previous"
            (click)="stepZone(-1)"
          >
            <ng-icon name="lucideChevronLeft" aria-hidden="true" />
          </button>
          <p aria-live="polite">
            {{
              fill(texts.gallery.position, {
                index: shot() + 1,
                count: zonePlaces().length,
              })
            }}
          </p>
          <button
            class="icon-button"
            type="button"
            [attr.aria-label]="texts.gallery.next"
            (click)="stepZone(1)"
          >
            <ng-icon name="lucideChevronRight" aria-hidden="true" />
          </button>
        </div>
      }
      @let picture = seen(shown());
      <p class="plan-caption" aria-live="polite">
        {{ picture.alt[language.code] }}
        @if (picture.generated) {
          <span class="ai-note"
            ><ng-icon name="lucideSparkles" aria-hidden="true" />{{
              texts.apartment.generated
            }}</span
          >
        }
      </p>
    </div>
  `,
  styles: `
    @layer components {
      .viewer-plan {
        grid-area: 2 / 1 / 3 / -1;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1.5rem 2.5rem;
        width: min(100cqw, 72rem);
        height: calc(100cqh - var(--size-control) - 0.75rem);
      }

      .plan-side {
        display: grid;
        grid-template-rows: minmax(0, 1fr) auto;
        gap: 1rem;
      }

      /* The plan as large as its room allows at its own ratio; the zones lie over it on the same
         viewBox, and the names at their points. */
      .plan-area {
        display: grid;
        place-items: center;
        container-type: size;
      }

      .plan-box {
        --room: 100cqh;
        position: relative;
        width: min(100cqw, var(--room) * var(--ratio));
        aspect-ratio: var(--ratio);

        > :is(img, svg) {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }
      }

      /* The chosen room in the accent: a frame for its edge, which a fill alone would not draw
         at 3:1, and a light fill for its area; a hovered one only the light fill. */
      .plan-box polygon {
        fill: var(--color-accent);
        fill-opacity: 0;
        stroke: var(--color-accent);
        stroke-opacity: 0;
        stroke-width: 2.5;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
        cursor: pointer;
        transition:
          fill-opacity 0.2s,
          stroke-opacity 0.2s;

        &:hover {
          fill-opacity: 0.1;
        }

        &[data-chosen] {
          fill-opacity: 0.18;
          stroke-opacity: 1;
        }
      }

      .plan-label {
        position: absolute;
        translate: -50% -50%;
        padding: 0.0625rem 0.5rem;
        border-radius: var(--radius-control);
        background: color-mix(in srgb, var(--color-surface) 88%, transparent);
        font-size: 0.8125rem;
        font-weight: 500;
        white-space: nowrap;
        pointer-events: none;
        visibility: hidden;

        &[data-fits] {
          visibility: visible;
        }

        &[data-chosen] {
          color: var(--color-accent);
        }
      }

      .zone-choices {
        justify-content: center;
      }

      .plan-photo {
        display: grid;
        grid-template-rows: minmax(0, 1fr) auto auto;
        gap: 0.75rem;
      }

      .plan-frame {
        display: grid;
        grid-template: minmax(0, 1fr) / minmax(0, 1fr);
        place-items: center;

        img {
          grid-area: 1 / 1;
          max-width: 100%;
          max-height: 100%;
          width: auto;
          height: auto;
        }
      }

      .plan-steps {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        font-size: 0.9375rem;
      }

      .plan-caption {
        min-height: 2lh;
        text-align: center;
        text-wrap: pretty;
      }

      /* On a phone, and any screen taller than wide, the plan stands above its rooms and the
         picture, scrolled as one; the plan at most about half the screen's height. */
      @media (width < 48rem), (orientation: portrait) {
        .viewer-plan {
          grid-template-columns: minmax(0, 1fr);
          align-content: start;
          overflow-y: auto;
        }

        .plan-side {
          grid-template-rows: auto;
        }

        .plan-area {
          container-type: inline-size;
        }

        .plan-box {
          --room: 45svh;
        }

        .plan-photo {
          grid-template-rows: auto;
        }

        .plan-frame {
          aspect-ratio: 4 / 3;

          img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
        }
      }

      /* On a phone it takes the screen's width, beyond the viewer's padding. */
      @media (width < 48rem) {
        .viewer-plan {
          width: auto;
          height: auto;
          margin-inline: -1rem;
          padding: 0.25rem 1rem 1rem;
        }
      }
    }
  `,
})
export class PlanView implements OnInit {
  readonly plan = input.required<Plan>();
  readonly places = input.required<Shown[][]>();
  // The place to open on: its room, the first of the plan's rooms its picture shows, or the
  // plan's first room for a picture of none.
  readonly start = input.required<number>();
  private readonly season = inject(Season);
  protected readonly texts = inject(TEXTS);
  protected readonly language = inject(LANGUAGE);
  protected readonly srcset = srcset;
  protected readonly fill = fill;
  protected readonly seen = (index: number) => seenIn(this.places()[index], this.season.current());

  protected readonly chosen = signal('');
  protected readonly shot = signal(0);
  // The places that name the chosen room, in the gallery's order, and the one shown among them,
  // from which the pictures' view goes on.
  protected readonly zonePlaces = computed(() =>
    this.places().flatMap((place, index) =>
      place.some(({ picture }) => picture.zones?.includes(this.chosen())) ? [index] : [],
    ),
  );
  readonly shown = computed(() => this.zonePlaces()[this.shot()]);
  // The rooms whose names fit inside them on the plan as it is drawn.
  protected readonly fits = signal<string[]>([]);
  protected readonly corners = (zone: Plan['zones'][number]) =>
    zone.points.map((point) => point.join(',')).join(' ');
  private readonly planBox = viewChild.required<ElementRef<HTMLElement>>('planBox');

  constructor() {
    afterRenderEffect((onCleanup) => {
      const box = this.planBox().nativeElement;
      const plan = this.plan();
      const observer = new ResizeObserver(() => {
        const scale = box.clientWidth / plan.viewBox[2];
        const labels = box.querySelectorAll<HTMLElement>('.plan-label');
        this.fits.set(
          plan.zones.flatMap(({ key, points }, index) => {
            const xs = points.map(([x]) => x);
            const room = (Math.max(...xs) - Math.min(...xs)) * scale;
            return labels[index].offsetWidth <= room ? [key] : [];
          }),
        );
      });
      observer.observe(box);
      onCleanup(() => observer.disconnect());
    });
  }

  ngOnInit() {
    const zones = this.seen(this.start()).zones ?? [];
    const plan = this.plan();
    this.chosen.set((plan.zones.find(({ key }) => zones.includes(key)) ?? plan.zones[0]).key);
    this.shot.set(Math.max(0, this.zonePlaces().indexOf(this.start())));
  }

  protected choose(key: string) {
    this.chosen.set(key);
    this.shot.set(0);
  }

  protected stepZone(by: number) {
    const count = this.zonePlaces().length;
    this.shot.update((shot) => (shot + by + count) % count);
  }

  // Plain arrows step through the room's pictures; on a radio they choose among its group.
  protected key(event: KeyboardEvent) {
    const by = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    const modified = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
    const radio = (event.target as Element).matches('input[type=radio]');
    if (!by || modified || radio || this.zonePlaces().length < 2) return;
    event.preventDefault();
    this.stepZone(by);
  }
}
