import { Component, inject, input, output, ViewEncapsulation } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import type { SeasonName } from '../content/names';
import { TEXTS } from './texts';

// What the bar says in one season: maybe an apartment's name, an amount with words around it,
// maybe the parts of a line below, and a link on with its label, or without a link a button the
// page answers. A chosen week has a cross that clears it.
export interface BarLine {
  season: SeasonName;
  name: string;
  before: string;
  amount: string;
  after: string;
  detail: string[];
  link: string | null;
  label: string;
  chosen: boolean;
}

// A bar in the accent that carries a choice on to booking, one line per season: the home page's
// chosen week below the list, and on a phone the apartment page's at the screen's foot. Each
// page places it.
@Component({
  encapsulation: ViewEncapsulation.None,
  selector: 'app-booking-bar',
  imports: [NgIcon],
  providers: [provideIcons({ lucideX })],
  template: `
    <div class="booking-bar" [hidden]="!shown()">
      @for (line of lines(); track line.season) {
        <div [attr.data-for]="line.season">
          <output>
            <span class="bar-parts">
              @if (line.name) {
                <span>{{ line.name }}</span>
              }
              <span
                >{{ line.before }}<strong>{{ line.amount }}</strong
                >{{ line.after }}</span
              >
            </span>
            @if (line.detail.length) {
              <small class="bar-parts">
                @for (part of line.detail; track $index) {
                  <span>{{ part }}</span>
                }
              </small>
            }
          </output>
          <div class="bar-actions">
            @if (line.chosen) {
              <button
                type="button"
                class="icon-button bar-clear"
                [attr.aria-label]="texts.weeks.clear"
                (click)="cleared.emit($event)"
              >
                <ng-icon name="lucideX" aria-hidden="true" />
              </button>
            }
            @if (line.link) {
              <a class="button" [href]="line.link">{{ line.label }}</a>
            } @else {
              <button type="button" class="button" (click)="pressed.emit()">
                {{ line.label }}
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    @layer components {
      .booking-bar {
        padding: 0.625rem 0.625rem 0.625rem 1.25rem;
        border-radius: var(--radius-card);
        background: var(--color-accent);
        color: var(--color-on-accent);

        > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        output {
          line-height: 1.25;
          text-wrap: balance;

          /* A line's parts share it where they fit, with a dot between them that goes beyond
             the bar's edge, clipped, when a part wraps to a line of its own. */
          .bar-parts {
            display: flex;
            flex-wrap: wrap;
            column-gap: 0.75em;
            overflow: hidden;

            > * + * {
              position: relative;

              &::before {
                content: '·' / '';
                position: absolute;
                right: 100%;
                width: 0.75em;
                text-align: center;
              }
            }
          }

          strong {
            font-weight: 500;
          }

          small {
            font-size: 0.875rem;
          }
        }

        /* On the accent the primary button's shadow would not show: it is underlined instead.
           Its words keep to one line; the bar's other words wrap. */
        .button {
          background: var(--color-surface);
          color: var(--color-accent);
          white-space: nowrap;
          text-decoration: underline;
          text-decoration-color: transparent;
          text-underline-offset: 0.3em;
          transition: text-decoration-color 0.2s;

          &:hover {
            box-shadow: none;
            text-decoration-color: currentcolor;
          }
        }

        :focus-visible {
          outline-color: var(--color-on-accent);
        }

        @media (max-width: 22.4375rem) {
          font-size: 1rem;

          .button {
            padding-inline: 1rem;
          }
        }

        /* Also when the page's season has no line, as one with no week to choose. */
        &[hidden],
        html:not([data-script]) &,
        html[data-season='winter'] &:not(:has([data-for='winter'])),
        html[data-season='summer'] &:not(:has([data-for='summer'])) {
          display: none;
        }
      }

      .bar-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      /* An icon button that shows a light ground under the pointer. */
      .bar-clear {
        transition: background-color 0.2s;

        &:hover {
          background: color-mix(in srgb, var(--color-on-accent) 15%, transparent);
        }

        ng-icon {
          --ng-icon__size: 1.375rem;
        }
      }
    }
  `,
})
export class BookingBar {
  readonly lines = input.required<BarLine[]>();
  readonly shown = input.required<boolean>();
  readonly cleared = output<MouseEvent>();
  readonly pressed = output();
  protected readonly texts = inject(TEXTS);
}
