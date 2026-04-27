'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from './input';

export type ComboboxOption = {
  value: string;
  label: string;
};

type ComboboxProps = {
  options: ComboboxOption[];
  value: string;
  onInputChange: (value: string) => void;
  onSelect: (option: ComboboxOption) => void;
  placeholder?: string;
  className?: string;
  loading?: boolean;
};

const Combobox = ({
  options,
  value,
  onInputChange,
  onSelect,
  placeholder,
  className,
  loading,
}: ComboboxProps) => {
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onInputChange(e.target.value);
    setOpen(true);
  };

  const handleSelect = (option: ComboboxOption) => {
    onSelect(option);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Input
        value={value}
        onChange={handleInputChange}
        onFocus={() => options.length > 0 && setOpen(true)}
        placeholder={placeholder}
      />
      {open && (options.length > 0 || loading) && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-background text-foreground shadow-md">
          {loading && (
            <li className="px-3 py-2 text-sm text-muted-foreground">Searching...</li>
          )}
          {options.map((option) => (
            <li
              key={option.value}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(option);
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export { Combobox };
