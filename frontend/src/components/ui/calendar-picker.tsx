'use client';
import * as React from 'react';
import {
  format,
  parse,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isValid,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
};

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const CalendarPicker = ({ value, onChange }: Props) => {
  const today = new Date();
  const selected = value ? parse(value, 'yyyy-MM-dd', today) : null;
  const [viewDate, setViewDate] = React.useState<Date>(
    selected && isValid(selected) ? selected : today
  );

  React.useEffect(() => {
    if (value) {
      const d = parse(value, 'yyyy-MM-dd', today);
      if (isValid(d)) setViewDate(d);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  return (
    <div className="rounded-md border bg-background p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewDate((d) => subMonths(d, 1))}
          className="rounded p-1 hover:bg-accent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">{format(viewDate, 'MMMM yyyy')}</span>
        <button
          type="button"
          onClick={() => setViewDate((d) => addMonths(d, 1))}
          className="rounded p-1 hover:bg-accent"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const isSelected = selected && isValid(selected) && isSameDay(day, selected);
          const isCurrentMonth = isSameMonth(day, viewDate);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onChange(format(day, 'yyyy-MM-dd'))}
              className={cn(
                'h-8 w-full rounded text-sm transition-colors',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground',
                !isCurrentMonth && 'opacity-30'
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export { CalendarPicker };
