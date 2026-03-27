'use client';

import { useState, useEffect, useMemo } from 'react';
import type { GroupByDimension, GroupByRow } from '@/lib/sales/types';

const SEARCH_KEYS: Record<GroupByDimension, string[]> = {
  'customer':      ['code', 'name'],
  'customer-type': ['name'],
  'fruit':         ['name'],
  'agent':         ['name'],
  'outlet':        ['name'],
};

/** Search-only filter for the table. Advanced filters are handled separately. */
export function useGroupByFilters(groupBy: GroupByDimension, data: GroupByRow[]) {
  const [searchQuery, setSearchQuery] = useState('');

  // Reset search when group changes
  useEffect(() => {
    setSearchQuery('');
  }, [groupBy]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    const keys = SEARCH_KEYS[groupBy];
    return data.filter((row) =>
      keys.some((key) => String(row[key] ?? '').toLowerCase().includes(q))
    );
  }, [data, searchQuery, groupBy]);

  return { searchQuery, setSearchQuery, filteredData };
}
