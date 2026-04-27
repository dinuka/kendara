'use client';
import * as React from 'react';
import { isValid, parse } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalendarPicker } from './calendar-picker';

type Props = {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
};

const DateInput = ({ value, onChange, className }: Props) => {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    let masked = digits;
    if (digits.length > 4) masked = `${digits.slice(0, 4)}-${digits.slice(4)}`;
    if (digits.length > 6) masked = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
    onChange(masked);
  };

  const handleCalendarChange = (date: string) => {
    onChange(date);
    setOpen(false);
  };

  const calendarValue = (() => {
    const d = parse(value, 'yyyy-MM-dd', new Date());
    return isValid(d) ? value : '';
  })();

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="flex gap-1">
        <input
          type="text"
          value={value}
          onChange={handleTextChange}
          placeholder="YYYY-MM-DD"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-transparent shadow-sm hover:bg-accent"
        >
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1">
          <CalendarPicker value={calendarValue} onChange={handleCalendarChange} />
        </div>
      )}
    </div>
  );
};

export { DateInput };
