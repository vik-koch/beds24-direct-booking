import {
  afterRenderEffect,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import type { Plan } from '../content/schema';
import { Files } from './files';
import { LANGUAGE } from './texts';

// The plan in the viewer's plan view: the shown picture's room framed in the accent, a click on a
// room asks for it, and the rooms' names show where they fit.
@Component({
  encapsulation: ViewEncapsulation.None,
  selector: 'app-plan-view',
  host: { class: 'viewer-plan' },
  imports: [Files],
  template: `
    <div #box class="plan-box" [style.--ratio]="plan().viewBox[2] / plan().viewBox[3]">
      <img [appFiles]="{ src: plan().url }" [alt]="plan().alt[language.code]" />
      <svg [attr.viewBox]="plan().viewBox.join(' ')" aria-hidden="true">
        @for (zone of plan().zones; track zone.key) {
          <polygon
            [attr.points]="corners(zone)"
            [attr.data-chosen]="zone.key === room() ? '' : null"
            (click)="choose.emit(zone.key)"
          />
        }
      </svg>
      @for (zone of plan().zones; track zone.key) {
        <span
          class="plan-label"
          aria-hidden="true"
          [attr.data-fits]="fits().includes(zone.key) ? '' : null"
          [attr.data-chosen]="zone.key === room() ? '' : null"
          [style.left.%]="((zone.label[0] - plan().viewBox[0]) / plan().viewBox[2]) * 100"
          [style.top.%]="((zone.label[1] - plan().viewBox[1]) / plan().viewBox[3]) * 100"
          >{{ zone.name[language.code] }}</span
        >
      }
    </div>
  `,
  styles: `
    @layer components {
      /* As large as the viewer gives it at its own ratio; the zones lie over it on the same
         viewBox, and the names at their points. */
      .viewer-plan {
        display: grid;
        place-items: center;
        container-type: size;
      }

      .plan-box {
        position: relative;
        width: min(100cqw, 100cqh * var(--ratio));
        aspect-ratio: var(--ratio);

        > :is(img, svg) {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }
      }

      /* The picture's room in the accent: a frame for its edge, which a fill alone would not
         draw at 3:1, and a light fill for its area; a hovered one only the light fill. */
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
    }
  `,
})
export class PlanView {
  readonly plan = input.required<Plan>();
  // The shown picture's room, if it is of one.
  readonly room = input<string>();
  readonly choose = output<string>();
  protected readonly language = inject(LANGUAGE);
  // The rooms whose names fit inside them, either side of their points, as the plan is drawn.
  protected readonly fits = signal<string[]>([]);
  protected readonly corners = (zone: Plan['zones'][number]) =>
    zone.points.map((point) => point.join(',')).join(' ');
  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');

  constructor() {
    afterRenderEffect((onCleanup) => {
      const box = this.box().nativeElement;
      const plan = this.plan();
      const observer = new ResizeObserver(() => {
        const scale = box.clientWidth / plan.viewBox[2];
        const labels = box.querySelectorAll<HTMLElement>('.plan-label');
        this.fits.set(
          plan.zones.flatMap(({ key, points, label }, index) =>
            labels[index].offsetWidth <= across(points, label) * scale ? [key] : [],
          ),
        );
      });
      observer.observe(box);
      onCleanup(() => observer.disconnect());
    });
  }
}

// The width a name centred on a point has inside a room: twice the nearer of the room's edges
// either side of the point, along the point's height.
function across(points: [number, number][], [x, y]: [number, number]) {
  const crossings = points
    .flatMap(([x1, y1], index) => {
      const [x2, y2] = points[(index + 1) % points.length];
      return y1 <= y !== y2 <= y ? [x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)] : [];
    })
    .sort((a, b) => a - b);
  for (let index = 0; index < crossings.length; index += 2)
    if (crossings[index] <= x && x <= crossings[index + 1])
      return 2 * Math.min(x - crossings[index], crossings[index + 1] - x);
  return 0;
}
