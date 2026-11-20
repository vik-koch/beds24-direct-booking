import { DOCUMENT } from '@angular/common';
import { Component, inject, input, ViewEncapsulation } from '@angular/core';
import type { SeasonName } from '../content/names';

// What the bar says in one season: an amount with words around it, maybe a line below, and a
// link on to booking with its label, or without a link the way to the panel.
export interface BarLine {
  season: SeasonName;
  before: string;
  amount: string;
  after: string;
  detail: string;
  link: string | null;
  label: string;
}

// On a phone, while the booking panel is out of view, a bar at the screen's foot keeps the way
// to it, or on to booking once a week is chosen. One line per season, as in the panel.
@Component({
  encapsulation: ViewEncapsulation.None,
  selector: 'app-booking-bar',
  template: `
    <div class="booking-bar" [hidden]="!shown()">
      @for (line of lines(); track line.season) {
        <div [attr.data-for]="line.season">
          <output
            >{{ line.before }}<strong>{{ line.amount }}</strong
            >{{ line.after }}
            @if (line.detail) {
              <small>{{ line.detail }}</small>
            }
          </output>
          @if (line.link) {
            <a class="button" [href]="line.link">{{ line.label }}</a>
          } @else {
            <button type="button" class="button" (click)="toPanel()">{{ line.label }}</button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    @layer components {
      .booking-bar {
        position: fixed;
        inset: auto 0.75rem 0.75rem;
        z-index: 15;
        padding: 0.625rem 0.625rem 0.625rem 1.25rem;
        border-radius: var(--radius-card);
        background: var(--color-surface);
        box-shadow: 0 0.5rem 2rem -0.5rem rgb(39 50 58 / 0.35);

        > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        output {
          color: var(--color-ink-soft);
          line-height: 1.25;

          strong {
            color: var(--color-ink);
            font-weight: 500;
          }

          small {
            display: block;
            font-size: 0.875rem;
          }
        }

        &[hidden],
        html:not([data-script]) & {
          display: none;
        }

        @media (min-width: 64rem) {
          display: none;
        }
      }
    }
  `,
})
export class BookingBar {
  readonly lines = input.required<BarLine[]>();
  readonly shown = input.required<boolean>();
  private readonly document = inject(DOCUMENT);

  // The focus goes to the panel's heading, which scrolls the panel into view.
  protected toPanel() {
    this.document.getElementById('booking-title')!.focus();
  }
}
