import { Component, inject, ViewEncapsulation } from '@angular/core';
import { BrnFieldA11yService } from '@spartan-ng/brain/field';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { Guests } from './guests';
import { TEXTS } from './texts';

// The group's adults and children, within what one of the apartments takes, each a pill with
// its label and its count, and the content's note on them, which an asterisk points to. On the
// home page above the free weeks (class guest-bar), in an apartment's booking panel.
@Component({
  encapsulation: ViewEncapsulation.None,
  selector: 'app-guest-counts',
  imports: [HlmSelectImports],
  // Gives both selects the note as their description.
  providers: [BrnFieldA11yService],
  template: `
    <div class="counts">
      <div class="count">
        <label for="adults"
          >{{ guests.asksChildren() ? texts.panel.adults.label : texts.panel.guests
          }}<span class="star" aria-hidden="true">{{
            guests.asksChildren() ? '' : star
          }}</span></label
        >
        <hlm-select
          [value]="guests.adults()"
          (valueChange)="guests.set($event!, guests.children())"
        >
          <hlm-select-trigger buttonId="adults" class="w-full justify-end">
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
            >{{ texts.panel.children
            }}<span class="star" aria-hidden="true">{{ star }}</span></label
          >
          <hlm-select
            [value]="guests.children()"
            (valueChange)="guests.set(guests.adults(), $event!)"
          >
            <hlm-select-trigger buttonId="children" class="w-full justify-end">
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
    </div>
    @if (note) {
      <p class="guests-note" id="guests-note"><span aria-hidden="true">*</span>{{ note }}</p>
    }
  `,
  styles: `
    @layer components {
      .guest-counts {
        display: block;
      }

      /* Side by side, each as wide as its words and sharing what is left; stacked, as wide as the
         row. */
      .counts {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      /* The label and the select's count are one pill: the select's button fills it, under the
         label, so a click anywhere opens it and its list is as wide as the pill. */
      .count {
        position: relative;
        display: flex;
        flex: 1 1 auto;
        align-items: center;
        height: var(--size-control-small);
        padding-left: 1rem;
        border: 1px solid var(--color-edge);
        border-radius: var(--radius-control);
        background: var(--color-surface);
        transition: border-color 0.2s;

        &:hover {
          border-color: var(--color-accent);
        }

        &:has(:focus-visible) {
          outline: var(--focus-ring);
          outline-offset: 2px;
        }

        label {
          position: relative;
          z-index: 1;
          /* Room for the count and its chevron, which the button draws at the end. */
          margin-right: 3.25rem;
          font-size: 0.9375rem;
          white-space: nowrap;
          pointer-events: none;
        }

        .star {
          color: var(--color-ink-soft);
        }
      }

      .guests-note {
        margin-top: 0.75rem;
        color: var(--color-ink-soft);
        font-size: 0.875rem;
      }

      /* Above the free weeks: white pills of a control's height on the page's ground, the note
         beside them where there is room. */
      .guest-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem 1.5rem;
        margin-bottom: 1rem;

        @media (min-width: 48rem) {
          margin-bottom: 1.5rem;
        }

        .counts {
          flex: 1 1 100%;

          @media (min-width: 40rem) {
            flex: none;
          }
        }

        .count {
          height: var(--size-control);
          padding-left: 1.25rem;
          border-color: transparent;
        }

        .guests-note {
          flex: 1 1 16rem;
          margin: 0;
        }
      }

      /* The copied select without its own frame: the pill is it, and the count stands at its end
         (w-full and justify-end, which win over its own utilities). The list's counts stand under
         it, their tick where the chevron is: the item's end padding is the pill's, less the
         list's own. */
      .spartan-select-trigger {
        position: absolute;
        inset: 0;
        gap: 0.25rem;
        padding-right: 0.875rem;
        border-radius: inherit;
        font-size: 0.9375rem;
        font-weight: 600;
        cursor: pointer;
      }

      /* It takes the free space, which the chevron's own margin would. */
      .spartan-select-trigger [data-slot='select-value'] {
        flex: 1;
        justify-content: flex-end;
      }

      :is(.spartan-select-trigger-icon, .spartan-select-item-indicator) {
        --ng-icon__size: 1rem;
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
        justify-content: flex-end;
        min-height: var(--size-control-small);
        padding-right: calc(0.875rem - 0.375rem + 1.25rem);
        border-radius: 0.5rem;
        font-size: 0.9375rem;
        font-weight: 500;
        cursor: pointer;

        &[data-highlighted] {
          background: var(--color-ground);
        }
      }

      .spartan-select-item-indicator {
        position: absolute;
        right: calc(0.875rem - 0.375rem);
        color: var(--color-accent);
      }
    }
  `,
  host: { class: 'guest-counts' },
})
export class GuestCounts {
  protected readonly guests = inject(Guests);
  protected readonly texts = inject(TEXTS);
  protected readonly note = this.texts.panel.guestsNote;
  protected readonly star = this.note ? '*' : '';

  constructor() {
    if (this.note) inject(BrnFieldA11yService).registerDescription('guests-note');
  }

  protected range(from: number, to: number) {
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }
}
