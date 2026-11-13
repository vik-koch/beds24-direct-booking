import { Component, computed, input, model, signal } from '@angular/core';
import { BrnCalendarImports } from '@spartan-ng/brain/calendar';
import { provideUtcDateAdapter } from '@spartan-ng/brain/date-time';
import { dayClass, dayLabel, rangePart, weekdays } from './calendar-day';
import { formatMonth, iso, months, Stay, stayOf, utc } from './stays';

@Component({
  selector: 'app-stay-calendar-spartan',
  imports: [BrnCalendarImports],
  providers: [provideUtcDateAdapter()],
  template: `
    <div class="flex flex-wrap gap-x-10 gap-y-6">
      @for (month of months(); track month.first) {
        <section
          brnCalendarRange
          class="w-full sm:w-72"
          [weekStartsOn]="1"
          [min]="month.min"
          [max]="month.max"
          [defaultFocusedDate]="month.focus"
          [dateDisabled]="blocked"
          [startDate]="start()"
          [endDate]="end()"
          (startDateChange)="pick($event)"
        >
          <div brnCalendarHeader class="pb-2 text-center font-medium">
            {{ formatMonth(month.first) }}
          </div>
          <table brnCalendarGrid class="w-full table-fixed">
            <thead aria-hidden="true">
              <tr>
                @for (weekday of weekdays; track weekday) {
                  <th class="text-muted-foreground pb-1 text-xs font-normal">{{ weekday }}</th>
                }
              </tr>
            </thead>
            <tbody role="rowgroup">
              <tr *brnCalendarWeek="let week">
                @for (date of week; track date.getTime()) {
                  <td brnCalendarCell class="p-0">
                    @if (iso(date).slice(0, 7) === month.first.slice(0, 7)) {
                      <button
                        brnCalendarCellButton
                        [date]="date"
                        [class]="dayClass"
                        [attr.aria-label]="dayLabel(stays(), iso(date))"
                        [attr.data-state]="stayOf(stays(), iso(date))?.state"
                        [attr.data-range]="rangePart(selected(), iso(date))"
                      >
                        {{ date.getUTCDate() }}
                      </button>
                    }
                  </td>
                }
              </tr>
            </tbody>
          </table>
        </section>
      }
    </div>
  `,
})
export class StayCalendarSpartan {
  readonly stays = input.required<Stay[]>();
  readonly selected = model<Stay>();
  // The calendar keeps its own start and end after a click; fresh Date objects push ours back in.
  private readonly picks = signal(0);
  // Stable Date objects: the calendar resets its focused date whenever one of these inputs changes.
  protected readonly months = computed(() =>
    months(this.stays()).map((month) => {
      const days = month.weeks.flat().filter((day) => !!day);
      return {
        first: month.first,
        min: utc(days[0].date),
        max: utc(days[days.length - 1].date),
        focus: utc((days.find((day) => day.stay?.state === 'free') ?? days[0]).date),
      };
    }),
  );
  protected readonly start = computed(() => this.bound(this.selected()?.start));
  protected readonly end = computed(() => this.bound(this.selected()?.end));
  protected readonly blocked = (date: Date) => stayOf(this.stays(), iso(date))?.state !== 'free';
  protected readonly weekdays = weekdays;
  protected readonly dayClass = dayClass;
  protected readonly dayLabel = dayLabel;
  protected readonly rangePart = rangePart;
  protected readonly stayOf = stayOf;
  protected readonly formatMonth = formatMonth;
  protected readonly iso = iso;

  protected pick(date: Date | undefined) {
    const stay = date && stayOf(this.stays(), iso(date));
    if (stay?.state === 'free') this.selected.set(stay);
    this.picks.update((count) => count + 1);
  }

  private bound(date: string | undefined) {
    this.picks();
    return date ? utc(date) : undefined;
  }
}
