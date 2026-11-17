import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSnowflake, lucideSun } from '@ng-icons/lucide';
import type { SeasonName } from '../content/names';
import { Season } from './season';
import { TEXTS } from './texts';

// A pill whose accent part glides to the chosen season; only the chosen one shows its name.
// Both names sit in one hidden cell, so the pill is as wide as the longer one. At rest the
// chosen label carries the accent, sized by its content, so the first paint needs no script;
// only the glide between two labels is measured and animated here. A choice made before the
// application has started is kept by hydration's event replay. It needs the click too: the
// radio checked by the server brings no change event when the script chose the other season,
// so a click on it would otherwise be lost.
@Component({
  selector: 'app-season-switch',
  imports: [NgIcon],
  providers: [provideIcons({ lucideSnowflake, lucideSun })],
  template: `
    @if (season.names.length > 1) {
      <div #box class="season-switch" role="radiogroup" [attr.aria-label]="texts.seasons.label">
        <span #pill class="season-pill" aria-hidden="true"></span>
        @for (name of season.names; track name) {
          <label [attr.data-for]="name" (pointerenter)="season.preload(name)">
            <input
              type="radio"
              name="season"
              [value]="name"
              [checked]="season.current() === name"
              (click)="choose(name)"
              (change)="choose(name)"
              (focus)="season.preload(name)"
            />
            <ng-icon [name]="icons[name]" aria-hidden="true" />
            <span class="season-name">{{ texts.seasons[name] }}</span>
          </label>
        }
        <span class="season-sizer" aria-hidden="true">
          <ng-icon name="lucideSun" />
          <span>
            @for (name of season.names; track name) {
              <span>{{ texts.seasons[name] }}</span>
            }
          </span>
        </span>
      </div>
    }
  `,
  host: { class: 'contents' },
})
export class SeasonSwitch {
  protected readonly season = inject(Season);
  protected readonly texts = inject(TEXTS);
  protected readonly icons = { winter: 'lucideSnowflake', summer: 'lucideSun' };
  private readonly box = viewChild<ElementRef<HTMLElement>>('box');
  private readonly pill = viewChild<ElementRef<HTMLElement>>('pill');
  private moves: Animation[] = [];

  protected choose(name: SeasonName) {
    if (name === this.season.current()) return;
    const box = this.box()?.nativeElement;
    const pill = this.pill()?.nativeElement;
    const labels = box ? [...box.querySelectorAll('label')] : [];
    // From where things are, mid-glide too: the pill if it glides, else the chosen label.
    const gliding = box?.hasAttribute('data-gliding');
    const start = box && pill && edges(box, gliding ? pill : chosen(box));
    const widths = labels.map((label) => label.getBoundingClientRect().width);
    this.season.switch(name);
    if (!box || !pill || !start) return;
    // Only this script's own moves: the colour transitions the change has just started stay.
    this.moves.forEach((one) => one.cancel());
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      box.removeAttribute('data-gliding');
      return;
    }
    box.setAttribute('data-gliding', '');
    const end = edges(box, chosen(box));
    // The edge that leads in the direction of the change moves first, the other one 90 ms
    // later, so the accent part stretches as it goes. Each label moves its inner edge with
    // the same timing, so it clips its name as the accent part leaves or reaches it.
    const lead = name === 'summer' ? 'right' : 'left';
    const move = (part: HTMLElement, property: string, from: number, to: number, edge: string) =>
      part.animate([{ [property]: `${from}px` }, { [property]: `${to}px` }], {
        duration: 320,
        delay: edge === lead ? 0 : 90,
        easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
        fill: 'both',
      });
    const moves = (this.moves = [
      move(pill, 'left', start.left, end.left, 'left'),
      move(pill, 'right', start.right, end.right, 'right'),
      ...labels.map((label, index) =>
        move(
          label,
          'width',
          widths[index],
          label.getBoundingClientRect().width,
          label.dataset['for'] === 'winter' ? 'right' : 'left',
        ),
      ),
    ]);
    Promise.all(moves.map((one) => one.finished)).then(
      () => {
        box.removeAttribute('data-gliding');
        moves.forEach((one) => one.cancel());
      },
      // Cancelled by the next change, which glides on from where this one stopped.
      () => undefined,
    );
  }
}

// The label of the season the page shows; the page's attribute decides, as in the styles.
const chosen = (box: HTMLElement) =>
  box.querySelector<HTMLElement>(
    `label[data-for=${box.ownerDocument.documentElement.dataset['season']}]`,
  )!;

// An element's edges as distances from the switch's sides, as the pill's left and right.
function edges(box: HTMLElement, part: HTMLElement) {
  const outer = box.getBoundingClientRect();
  const inner = part.getBoundingClientRect();
  return { left: inner.left - outer.left, right: outer.right - inner.right };
}
