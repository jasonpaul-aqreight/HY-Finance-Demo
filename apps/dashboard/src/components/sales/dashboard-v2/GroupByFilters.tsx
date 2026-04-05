'use client';

import { Input } from '@/components/ui/input';
import { SearchIcon } from 'lucide-react';
import type { GroupByDimension } from '@/lib/sales/types';

const PLACEHOLDERS: Record<GroupByDimension, string> = {
  'customer':      'Search by code or name...',
  'customer-type': 'Search by customer type',
  'fruit':         'Search by product name',
  'agent':         'Search by sales agent',
  'outlet':        'Search by outlet',
};

interface GroupByFiltersProps {
  groupBy: GroupByDimension;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function GroupByFilters({ groupBy, searchQuery, onSearchChange }: GroupByFiltersProps) {
  return (
    <div className="relative flex-1 max-w-sm">
      <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <Input
        placeholder={PLACEHOLDERS[groupBy]}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="pl-8"
      />
    </div>
  );
}
