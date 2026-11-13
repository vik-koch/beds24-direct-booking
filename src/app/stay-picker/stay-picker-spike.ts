import { Component, computed, linkedSignal, signal } from '@angular/core';
import { StayCalendarAria } from './stay-calendar-aria';
import { StayCalendarSpartan } from './stay-calendar-spartan';
import { StayList } from './stay-list';
import { fixtures, formatPrice, formatStay, Stay } from './stays';

@Component({
  selector: 'app-stay-picker-spike',
  imports: [StayList, StayCalendarSpartan, StayCalendarAria],
  template: `
    <section class="mx-auto max-w-5xl p-4" aria-labelledby="spike-heading">
      <h2 id="spike-heading" class="pb-4 text-xl font-semibold">Stay picker spike</h2>

      <div class="flex flex-wrap gap-x-6 gap-y-2 pb-6 text-sm">
        @for (control of controls; track control.label) {
          <label class="flex items-center gap-2">
            {{ control.label }}
            <select
              class="rounded-md border px-2 py-1"
              (change)="control.value.set($any($event.target).value)"
            >
              @for (option of control.options; track option) {
                <option [selected]="option === control.value()">{{ option }}</option>
              }
            </select>
          </label>
        }
      </div>

      @if (stays().length) {
        @switch (view()) {
          @case ('list') {
            <app-stay-list [stays]="stays()" [(selected)]="selected" />
          }
          @case ('calendar (spartan)') {
            <app-stay-calendar-spartan [stays]="stays()" [(selected)]="selected" />
          }
          @case ('calendar (aria grid)') {
            <app-stay-calendar-aria [stays]="stays()" [(selected)]="selected" />
          }
        }
      } @else {
        <p>No stays are on offer at the moment.</p>
      }

      <p class="pt-6 font-medium" aria-live="polite">
        @if (selected(); as stay) {
          Selected: {{ formatStay(stay) }}, {{ formatPrice(stay.price) }}
        } @else {
          No stay selected.
        }
      </p>
    </section>
  `,
})
export class StayPickerSpike {
  protected readonly view = signal('list');
  protected readonly data = signal('mixed');
  protected readonly stays = computed(() => fixtures[this.data()]);
  // A stay of the other data set is dropped; the view switch keeps the selection.
  protected readonly selected = linkedSignal<Stay[], Stay | undefined>({
    source: this.stays,
    computation: () => undefined,
  });
  protected readonly controls = [
    {
      label: 'View',
      value: this.view,
      options: ['list', 'calendar (spartan)', 'calendar (aria grid)'],
    },
    { label: 'Data', value: this.data, options: Object.keys(fixtures) },
  ];
  protected readonly formatStay = formatStay;
  protected readonly formatPrice = formatPrice;
}
