import { formatLongDay, stateLabel, Stay, stayOf } from './stays';

export const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const dayLabel = (stays: Stay[], date: string) =>
  `${formatLongDay(date)}, ${stateLabel(stayOf(stays, date))}`;

export const rangePart = (selected: Stay | undefined, date: string) =>
  !selected || date < selected.start || date > selected.end
    ? null
    : date === selected.start
      ? 'start'
      : date === selected.end
        ? 'end'
        : 'middle';

export const dayClass =
  'h-10 w-full rounded-md text-center text-sm tabular-nums ' +
  'cursor-pointer hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ' +
  'aria-disabled:cursor-default aria-disabled:text-muted-foreground aria-disabled:hover:bg-transparent ' +
  'data-[state=booked]:not-data-[range=end]:line-through ' +
  'data-[range=middle]:rounded-none data-[range=middle]:bg-muted data-[range=middle]:text-foreground ' +
  'data-[range=start]:bg-primary data-[range=start]:text-primary-foreground data-[range=start]:hover:bg-primary ' +
  'data-[range=end]:bg-primary data-[range=end]:text-primary-foreground data-[range=end]:hover:bg-primary';
