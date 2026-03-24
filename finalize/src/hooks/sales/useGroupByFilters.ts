'use client';

import { useState, useEffect, useMemo } from 'react';
import type { GroupByDimension, GroupByRow } from '@/lib/sales/types';

const SEARCH_KEYS: Record<GroupByDimension, string[]> = {
  'customer':      ['code', 'name'],
  'customer-type': ['name'],
  'fruit':         ['name'],
  'fruit-country': ['name'],
  'fruit-variant': ['name'],
  'agent':         ['name'],
  'outlet':        ['name'],
};

export function useGroupByFilters(groupBy: GroupByDimension, data: GroupByRow[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownValue, setDropdownValue] = useState<string | string[]>('');

  // Reset filters when tab changes
  useEffect(() => {
    setSearchQuery('');
    setDropdownValue(groupBy === 'fruit-variant' ? [] : '');
  }, [groupBy]);

  const filteredData = useMemo(() => {
    let result = data;

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const keys = SEARCH_KEYS[groupBy];
      result = result.filter((row) =>
        keys.some((key) => String(row[key] ?? '').toLowerCase().includes(q))
      );
    }

    // Apply dropdown filter — customer category (single-select)
    if (groupBy === 'customer' && typeof dropdownValue === 'string' && dropdownValue !== '') {
      result = result.filter((row) => row.customer_type === dropdownValue);
    }

    // Apply dropdown filter — agent active status (single-select)
    if (groupBy === 'agent' && typeof dropdownValue === 'string' && dropdownValue !== '') {
      const activeFlag = dropdownValue === 'Active' ? 'T' : 'F';
      result = result.filter((row) => row.is_active === activeFlag);
    }

    // Apply dropdown filter — fruit-variant fruit (multi-select)
    if (groupBy === 'fruit-variant' && Array.isArray(dropdownValue) && dropdownValue.length > 0) {
      result = result.filter((row) => {
        const fruit = String(row.name ?? '').split(' — ')[0].trim();
        return dropdownValue.includes(fruit);
      });
    }

    return result;
  }, [data, searchQuery, dropdownValue, groupBy]);

  return { searchQuery, setSearchQuery, dropdownValue, setDropdownValue, filteredData };
}
