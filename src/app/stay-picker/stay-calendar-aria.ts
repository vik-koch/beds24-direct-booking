import { Grid, GridCell, GridRow } from '@angular/aria/grid';
import { Component, computed, input, model } from '@angular/core';
import { dayClass, dayLabel, rangePart, weekdays } from './calendar-day';
import { Day, formatMonth, months, Stay } from './stays';

@Component({
  selector: 'app-stay-calendar-aria',
  imports: [Grid, GridRow, GridCell],
  template: `
    <div class="flex flex-wrap gap-x-10 gap-y-6">
      @for (month of months(); track month.first) {
        <section class="w-full sm:w-72">
          <h3 class="pb-2 text-center font-medium" [id]="'month-' + month.first">
            {{ formatMonth(month.first) }}
          </h3>
          <table
            ngGrid
            [softDisabled]="false"
            rowWrap="nowrap"
            colWrap="nowrap"
            class="w-full table-fixed"
            [attr.aria-labelledby]="'month-' + month.first"
          >
            <thead>
              <tr>
                @for (weekday of weekdays; track weekday) {
                  <th scope="col" class="text-muted-foreground pb-1 text-xs font-normal">
                    {{ weekday }}
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (week of month.weeks; track $index) {
                <tr ngGridRow>
                  @for (day of week; track $index) {
                    @if (day) {
                      <td
                        ngGridCell
                        [class]="dayClass"
                        [disabled]="day.stay?.state !== 'free'"
                        [attr.aria-label]="label(day)"
                        [attr.data-state]="day.stay?.state"
                        [attr.data-range]="rangePart(selected(), day.date)"
                        (click)="pick(day)"
                        (keydown.enter)="pick(day)"
                        (keydown.space)="pick(day); $event.preventDefault()"
                      >
                        {{ +day.date.slice(8) }}
                      </td>
                    } @else {
                      <td ngGridCell disabled></td>
                    }
                  }
                </tr>
              }
            </tbody>
          </table>
        </section>
      }
    </div>
  `,
})
export class StayCalendarAria {
  readonly stays = input.required<Stay[]>();
  readonly selected = model<Stay>();
  protected readonly months = computed(() => months(this.stays()));
  protected readonly weekdays = weekdays;
  protected readonly dayClass = dayClass;
  protected readonly rangePart = rangePart;
  protected readonly formatMonth = formatMonth;

  // The grid removes an aria-selected it does not own, so the name carries the selection.
  protected label(day: Day) {
    const selected = rangePart(this.selected(), day.date) ? ', selected' : '';
    return dayLabel(this.stays(), day.date) + selected;
  }

  protected pick(day: Day) {
    if (day.stay?.state === 'free') this.selected.set(day.stay);
  }
}
