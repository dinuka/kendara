'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

type Props = {
  value: string; // HH:MM
  onChange: (value: string) => void;
  className?: string;
};

const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const TimePicker = ({ value, onChange, className }: Props) => {
  const [hh, mm] = value ? value.split(':') : ['', ''];

  const handleHour = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(`${e.target.value}:${mm || '00'}`);
  };

  const handleMinute = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(`${hh || '00'}:${e.target.value}`);
  };

  const selectClass =
    'h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <select value={hh} onChange={handleHour} className={selectClass}>
        <option value="">HH</option>
        {hours.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-sm text-muted-foreground">:</span>
      <select value={mm} onChange={handleMinute} className={selectClass}>
        <option value="">MM</option>
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
};

export { TimePicker };
