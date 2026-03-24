'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Button } from '@/components/ui/button';
import { SearchIcon, ChevronsUpDownIcon } from 'lucide-react';
import type { GroupByDimension, GroupByRow } from '@/lib/sales/types';

const PLACEHOLDERS: Record<GroupByDimension, string> = {
  'customer':      'Search by customer code or name',
  'customer-type': 'Search by category',
  'fruit':         'Search by fruit name',
  'fruit-country': 'Search by country',
  'fruit-variant': 'Search by variant name',
  'agent':         'Search by agent name',
  'outlet':        'Search by location',
};

interface GroupByFiltersProps {
  groupBy: GroupByDimension;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  dropdownValue: string | string[];
  onDropdownChange: (v: string | string[]) => void;
  data: GroupByRow[];
}

export function GroupByFilters({
  groupBy,
  searchQuery,
  onSearchChange,
  dropdownValue,
  onDropdownChange,
  data,
}: GroupByFiltersProps) {
  // Derive category options for customer tab
  const categoryOptions = useMemo(() => {
    if (groupBy !== 'customer') return [];
    const set = new Set(data.map((r) => String(r.customer_type ?? '')).filter(Boolean));
    return [...set].sort();
  }, [data, groupBy]);

  // Derive fruit options for variant tab
  const fruitOptions = useMemo(() => {
    if (groupBy !== 'fruit-variant') return [];
    const set = new Set(
      data.map((r) => String(r.name ?? '').split(' — ')[0].trim()).filter(Boolean)
    );
    return [...set].sort();
  }, [data, groupBy]);

  return (
    <div className="flex items-center gap-3">
      {/* Search input */}
      <div className="relative flex-1 max-w-sm">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={PLACEHOLDERS[groupBy]}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Customer tab: category dropdown (single-select) */}
      {groupBy === 'customer' && categoryOptions.length > 0 && (
        <Select
          value={dropdownValue as string}
          onValueChange={(val) => onDropdownChange(val ?? '')}
        >
          <SelectTrigger size="sm">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Categories</SelectItem>
            {categoryOptions.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Agent tab: active status dropdown (single-select) */}
      {groupBy === 'agent' && (
        <Select
          value={dropdownValue as string}
          onValueChange={(val) => onDropdownChange(val ?? '')}
        >
          <SelectTrigger size="sm">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Variant tab: fruit dropdown (multi-select) */}
      {groupBy === 'fruit-variant' && fruitOptions.length > 0 && (
        <FruitMultiSelect
          options={fruitOptions}
          selected={dropdownValue as string[]}
          onChange={(val) => onDropdownChange(val)}
        />
      )}
    </div>
  );
}

/* ---------- Multi-select for Fruit ---------- */

function FruitMultiSelect({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (fruit: string) => {
    onChange(
      selected.includes(fruit)
        ? selected.filter((f) => f !== fruit)
        : [...selected, fruit]
    );
  };

  const label =
    selected.length === 0
      ? 'All Fruits'
      : selected.length === 1
        ? selected[0]
        : `${selected.length} fruits selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-sm font-normal">
            {label}
            <ChevronsUpDownIcon className="size-3.5 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search fruit..." />
          <CommandList>
            <CommandEmpty>No fruit found.</CommandEmpty>
            {selected.length > 0 && (
              <CommandItem
                onSelect={() => onChange([])}
                className="justify-center text-xs text-muted-foreground"
              >
                Clear selection
              </CommandItem>
            )}
            {options.map((fruit) => (
              <CommandItem
                key={fruit}
                data-checked={selected.includes(fruit)}
                onSelect={() => toggle(fruit)}
              >
                {fruit}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
