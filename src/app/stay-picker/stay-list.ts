import { Component, input, model } from '@angular/core';
import { formatStay, stateLabel, Stay } from './stays';

@Component({
  selector: 'app-stay-list',
  template: `
    <fieldset>
      <legend class="sr-only">Stays</legend>
      <ul class="gap-x-4 sm:columns-2 lg:columns-3">
        @for (stay of stays(); track stay.start) {
          <li class="break-inside-avoid pb-2">
            <label
              class="has-checked:border-primary has-checked:bg-muted has-disabled:text-muted-foreground has-focus-visible:ring-ring flex items-center gap-3 rounded-md border px-3 py-2 has-focus-visible:ring-2"
            >
              <input
                type="radio"
                name="stay"
                class="accent-primary size-4"
                [value]="stay.start"
                [checked]="stay === selected()"
                [disabled]="stay.state !== 'free'"
                (change)="selected.set(stay)"
              />
              <span class="grow">{{ formatStay(stay) }}</span>
              <span class="tabular-nums">{{ stateLabel(stay) }}</span>
            </label>
          </li>
        }
      </ul>
    </fieldset>
  `,
})
export class StayList {
  readonly stays = input.required<Stay[]>();
  readonly selected = model<Stay>();
  protected readonly formatStay = formatStay;
  protected readonly stateLabel = stateLabel;
}
