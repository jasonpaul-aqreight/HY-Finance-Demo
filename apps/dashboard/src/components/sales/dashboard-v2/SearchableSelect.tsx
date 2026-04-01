'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ChevronsUpDownIcon } from 'lucide-react';

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;       // e.g. "All Countries"
  searchPlaceholder?: string; // e.g. "Search country..."
  className?: string;
  popoverWidth?: string;      // e.g. "w-[300px]"
  disabled?: boolean;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  className,
  popoverWidth = 'w-[220px]',
  disabled,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);

  const displayLabel = value || placeholder;

  return (
    <Popover open={disabled ? false : open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className={`h-8 gap-1.5 text-sm font-normal justify-between ${className ?? ''}`}
          >
            <span className="truncate">{displayLabel}</span>
            <ChevronsUpDownIcon className="size-3.5 text-muted-foreground shrink-0" />
          </Button>
        }
      />
      <PopoverContent className={`${popoverWidth} p-0`} align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder ?? `Search...`} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandItem
              data-checked={!value}
              onSelect={() => {
                onChange('');
                setOpen(false);
              }}
            >
              {placeholder}
            </CommandItem>
            {options.map((opt) => (
              <CommandItem
                key={opt}
                data-checked={value === opt}
                onSelect={() => {
                  onChange(opt);
                  setOpen(false);
                }}
              >
                {opt}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
