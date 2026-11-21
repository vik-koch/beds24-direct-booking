import { Component, inject, ViewEncapsulation } from '@angular/core';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import site from '../content/generated/site';
import { Guests } from './guests';
import { fill, TEXTS } from './texts';

// The group's adults and children, within what one of the apartments takes, and a word on
// babies. On the home page above the free weeks, in an apartment's booking panel.
@Component({
  encapsulation: ViewEncapsulation.None,
  selector: 'app-guest-counts',
  imports: [HlmSelectImports],
  template: `
    <div class="count">
      <label [class.guests-title]="!guests.asksChildren()" for="adults">{{
        guests.asksChildren() ? texts.panel.adults.label : texts.panel.guests
      }}</label>
      <hlm-select [value]="guests.adults()" (valueChange)="guests.set($event!, guests.children())">
        <hlm-select-trigger buttonId="adults" [class]="trigger">
          <hlm-select-value />
        </hlm-select-trigger>
        <hlm-select-content *hlmSelectPortal>
          @for (n of range(1, guests.maxAdults()); track n) {
            <hlm-select-item [value]="n">{{ n }}</hlm-select-item>
          }
        </hlm-select-content>
      </hlm-select>
    </div>
    @if (guests.asksChildren()) {
      <div class="count">
        <label for="children"
          >{{ texts.panel.children }}
          <small>{{ fill(texts.panel.childAge, { age: childAge }) }}</small></label
        >
        <hlm-select
          [value]="guests.children()"
          (valueChange)="guests.set(guests.adults(), $event!)"
        >
          <hlm-select-trigger buttonId="children" [class]="trigger">
            <hlm-select-value />
          </hlm-select-trigger>
          <hlm-select-content *hlmSelectPortal>
            @for (n of range(0, guests.maxChildren()); track n) {
              <hlm-select-item [value]="n">{{ n }}</hlm-select-item>
            }
          </hlm-select-content>
        </hlm-select>
      </div>
    }
    <p class="babies">{{ texts.panel.babies }}</p>
  `,
  styles: `
    @layer components {
      /* The selects line up below their labels, however many lines a label takes; the word on
         babies goes below them, or beside them where the host makes room. */
      .guest-counts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-template-rows: auto auto;
        gap: 0.375rem 1rem;
      }

      .count {
        display: grid;
        grid-row: span 2;
        grid-template-rows: subgrid;

        label {
          align-self: end;
        }

        small {
          color: var(--color-ink-soft);
          font-size: 0.9375rem;
          white-space: nowrap;
        }

        .guests-title {
          font-size: 1.0625rem;
          font-weight: 500;
        }
      }

      .babies {
        grid-column: 1 / -1;
        margin-top: 0.375rem;
        color: var(--color-ink-soft);
        font-size: 0.875rem;
      }

      /* Above the free weeks, a card as wide as the list's, padded as it is; where there is room
         the word on babies stands beside the selects. */
      .guest-counts.guest-card {
        margin-bottom: 1rem;
        padding: 1rem 1.25rem 1.25rem;

        @media (min-width: 48rem) {
          grid-template-columns: repeat(2, minmax(0, 12rem));
          column-gap: 1.5rem;
          margin-bottom: 1.5rem;
          padding: 1.25rem 2.5rem 1.5rem;
        }

        @media (min-width: 64rem) {
          grid-template-columns: repeat(2, minmax(0, 12rem)) minmax(0, 1fr);

          .babies {
            grid-column: 3;
            grid-row: 2;
            align-self: center;
            margin-top: 0;
          }
        }
      }

      /* The copied select in the site's look: a pill like the other controls, its list a menu's
         card. Here and not in ui.css, so that it loads only with the pages that use it. */
      .spartan-select-trigger {
        gap: 0.5rem;
        min-height: var(--size-control);
        padding: 0 0.875rem 0 1rem;
        border: 1px solid var(--color-edge);
        border-radius: var(--radius-control);
        background: var(--color-surface);
        font-weight: 500;
        cursor: pointer;
        transition: border-color 0.2s;

        &:hover,
        &[aria-expanded='true'] {
          border-color: var(--color-accent);
        }
      }

      .spartan-select-trigger-icon {
        color: var(--color-ink-soft);
        transition: rotate 0.2s;

        [aria-expanded='true'] > & {
          rotate: 180deg;
        }
      }

      .spartan-select-content {
        flex-direction: column;
        max-height: min(18rem, var(--brn-select-content-available-height, 18rem));
        padding: 0.375rem;
        border-radius: var(--radius-menu);
        background: var(--color-surface);
        box-shadow: var(--shadow-card);
      }

      .spartan-select-item {
        justify-content: space-between;
        min-height: var(--size-control-small);
        padding: 0 0.75rem;
        border-radius: 0.5rem;
        font-weight: 500;
        cursor: pointer;

        &[data-highlighted] {
          background: var(--color-ground);
        }
      }

      .spartan-select-item-indicator {
        color: var(--color-accent);
      }
    }
  `,
  host: { class: 'guest-counts' },
})
export class GuestCounts {
  protected readonly guests = inject(Guests);
  protected readonly texts = inject(TEXTS);
  protected readonly fill = fill;
  protected readonly childAge = site.childAge;
  // The copied trigger takes its outline away; its ring is the site's, as on every control.
  protected readonly trigger =
    'w-full focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent';

  protected range(from: number, to: number) {
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }
}
