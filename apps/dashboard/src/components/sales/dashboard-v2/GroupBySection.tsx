'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useStableData } from '@/hooks/useStableData';
import { useGroupByData } from '@/hooks/sales/useGroupByData';
import { useGroupByFilters } from '@/hooks/sales/useGroupByFilters';
import type { DashboardFiltersV2 } from '@/hooks/sales/useDashboardFiltersV2';
import type { GroupByDimension, GroupByRow } from '@/lib/sales/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GroupByChart } from './GroupByChart';
import { GroupByTable } from './GroupByTable';
import { GroupByFilters } from './GroupByFilters';
import { SearchableSelect } from './SearchableSelect';

const MAX_SELECTED = 10;

const GROUP_OPTIONS: { value: GroupByDimension; label: string }[] = [
  { value: 'customer', label: 'Customer' },
  { value: 'fruit', label: 'Fruit' },
  { value: 'agent', label: 'Sales Agent' },
  { value: 'outlet', label: 'Outlet' },
];

/** Unique row key — for fruit uses composite, others use name */
function rowKey(row: GroupByRow, group: GroupByDimension): string {
  if (group === 'fruit') {
    return `${row.name}|${row.fruit_country ?? ''}|${row.fruit_variant ?? ''}`;
  }
  return row.name;
}

function getDefaultSelection(
  data: GroupByRow[],
  group: GroupByDimension,
): Set<string> {
  const sorted = [...data].sort((a, b) => b.total_sales - a.total_sales);
  return new Set(sorted.slice(0, MAX_SELECTED).map((r) => rowKey(r, group)));
}

interface GroupBySectionProps {
  filters: DashboardFiltersV2;
  setFilters: (updates: Partial<DashboardFiltersV2>) => void;
}

export function GroupBySection({ filters, setFilters }: GroupBySectionProps) {
  // ─── Advanced filter state ────────────────────────────────────────────────
  const [advancedFilter, setAdvancedFilter] = useState('');
  const [fruitName, setFruitName] = useState('');
  const [fruitCountry, setFruitCountry] = useState('');
  const [fruitVariant, setFruitVariant] = useState('');

  // Reset all advanced filters when group changes
  useEffect(() => {
    setAdvancedFilter('');
    setFruitName('');
    setFruitCountry('');
    setFruitVariant('');
  }, [filters.groupBy]);

  // ─── Data fetching ──────────────────────────────────────────────────────
  const { data: rawData, isLoading } = useGroupByData(filters);
  const data = useStableData(rawData) ?? [];

  // ─── Apply client-side advanced filters (all groups) ────────────────────
  const advFilteredData = useMemo(() => {
    let result = data;

    if (filters.groupBy === 'customer' && advancedFilter) {
      result = result.filter((row) => row.customer_type === advancedFilter);
    }
    if (filters.groupBy === 'agent' && advancedFilter) {
      const flag = advancedFilter === 'Active' ? 'T' : 'F';
      result = result.filter((row) => row.is_active === flag);
    }
    if (filters.groupBy === 'fruit') {
      if (fruitName) {
        result = result.filter((row) => row.name === fruitName);
      }
      if (fruitCountry) {
        result = result.filter((row) => row.fruit_country === fruitCountry);
      }
      if (fruitVariant) {
        result = result.filter((row) => row.fruit_variant === fruitVariant);
      }
    }

    return result;
  }, [data, advancedFilter, fruitName, fruitCountry, fruitVariant, filters.groupBy]);

  // ─── Derive dropdown options (interdependent for fruit) ─────────────────
  const categoryOptions = useMemo(() => {
    if (filters.groupBy !== 'customer') return [];
    const set = new Set(data.map((r) => String(r.customer_type ?? '')).filter(Boolean));
    return [...set].sort();
  }, [data, filters.groupBy]);

  const fruitNameOptions = useMemo(() => {
    if (filters.groupBy !== 'fruit') return [];
    // Scope by current country + variant selections
    let rows = data;
    if (fruitCountry) rows = rows.filter((r) => r.fruit_country === fruitCountry);
    if (fruitVariant) rows = rows.filter((r) => r.fruit_variant === fruitVariant);
    const set = new Set(rows.map((r) => r.name).filter(Boolean));
    return [...set].sort();
  }, [data, fruitCountry, fruitVariant, filters.groupBy]);

  const fruitCountryOptions = useMemo(() => {
    if (filters.groupBy !== 'fruit') return [];
    // Scope by current fruit name + variant selections
    let rows = data;
    if (fruitName) rows = rows.filter((r) => r.name === fruitName);
    if (fruitVariant) rows = rows.filter((r) => r.fruit_variant === fruitVariant);
    const set = new Set(rows.map((r) => String(r.fruit_country ?? '')).filter((v) => v && v !== '(Unknown)'));
    return [...set].sort();
  }, [data, fruitName, fruitVariant, filters.groupBy]);

  const fruitVariantOptions = useMemo(() => {
    if (filters.groupBy !== 'fruit') return [];
    // Scope by current fruit name + country selections
    let rows = data;
    if (fruitName) rows = rows.filter((r) => r.name === fruitName);
    if (fruitCountry) rows = rows.filter((r) => r.fruit_country === fruitCountry);
    const set = new Set(rows.map((r) => String(r.fruit_variant ?? '')).filter((v) => v && v !== '(Unknown)'));
    return [...set].sort();
  }, [data, fruitName, fruitCountry, filters.groupBy]);

  // ─── Search filter (table only) ──────────────────────────────────────────
  const {
    searchQuery,
    setSearchQuery,
    filteredData,
  } = useGroupByFilters(filters.groupBy, advFilteredData);

  // ─── Selection state ──────────────────────────────────────────────────────
  const [selectedNames, setSelectedNames] = useState<Set<string>>(
    () => getDefaultSelection(advFilteredData, filters.groupBy),
  );

  const dataFingerprint = `${filters.groupBy}:${advFilteredData.length}:${advFilteredData[0]?.name ?? ''}:${fruitName}:${fruitCountry}:${fruitVariant}:${advancedFilter}`;

  useEffect(() => {
    setSelectedNames(getDefaultSelection(advFilteredData, filters.groupBy));
  }, [dataFingerprint]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = useCallback((key: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else if (next.size < MAX_SELECTED) {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setSelectedNames(getDefaultSelection(advFilteredData, filters.groupBy));
  }, [advFilteredData, filters.groupBy]);

  // ─── Derived data for chart (based on selection from advFilteredData) ────
  const selectedData = useMemo(() => {
    const filtered = advFilteredData.filter((r) => selectedNames.has(rowKey(r, filters.groupBy)));
    if (filters.groupBy === 'fruit') {
      // Create a unique display name for chart labels
      return filtered.map((r) => ({
        ...r,
        name: `${r.name} (${r.fruit_country ?? ''} — ${r.fruit_variant ?? ''})`,
      }));
    }
    return filtered;
  }, [advFilteredData, selectedNames, filters.groupBy]);

  // ─── Determine which advanced filters to show ───────────────────────────
  const showAdvancedFilters =
    filters.groupBy === 'customer' ||
    filters.groupBy === 'agent' ||
    filters.groupBy === 'fruit';

  const filtersLoading = isLoading && data.length === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <CardTitle>Sales Breakdown</CardTitle>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Group by:</span>
              <Select
                value={filters.groupBy}
                onValueChange={(val) => setFilters({ groupBy: val as GroupByDimension })}
              >
                <SelectTrigger className="w-[200px] h-8 text-sm">
                  <SelectValue>
                    {GROUP_OPTIONS.find(o => o.value === filters.groupBy)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {GROUP_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Advanced filters — directly under Group By, right-aligned */}
            {showAdvancedFilters && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground shrink-0">Filter by:</span>

                {/* Customer: Category */}
                {filters.groupBy === 'customer' && (
                  <SearchableSelect
                    value={advancedFilter}
                    onChange={(val) => setAdvancedFilter(val)}
                    options={categoryOptions}
                    placeholder="All Categories"
                    searchPlaceholder="Search category..."
                    className="w-[200px]"
                    disabled={filtersLoading}
                  />
                )}

                {/* Agent: Active/Inactive */}
                {filters.groupBy === 'agent' && (
                  <SearchableSelect
                    value={advancedFilter}
                    onChange={(val) => setAdvancedFilter(val)}
                    options={['Active', 'Inactive']}
                    placeholder="All Status"
                    searchPlaceholder="Search status..."
                    className="w-[200px]"
                    disabled={filtersLoading}
                  />
                )}

                {/* Fruit: Name */}
                {filters.groupBy === 'fruit' && (
                  <SearchableSelect
                    value={fruitName}
                    onChange={(val) => setFruitName(val)}
                    options={fruitNameOptions}
                    placeholder="All Fruits"
                    searchPlaceholder="Search fruit..."
                    className="w-[200px]"
                    disabled={filtersLoading}
                  />
                )}

                {/* Fruit: Country */}
                {filters.groupBy === 'fruit' && (
                  <SearchableSelect
                    value={fruitCountry}
                    onChange={(val) => setFruitCountry(val)}
                    options={fruitCountryOptions}
                    placeholder="All Countries"
                    searchPlaceholder="Search country..."
                    className="w-[200px]"
                    disabled={filtersLoading}
                  />
                )}

                {/* Fruit: Variant */}
                {filters.groupBy === 'fruit' && (
                  <SearchableSelect
                    value={fruitVariant}
                    onChange={(val) => setFruitVariant(val)}
                    options={fruitVariantOptions}
                    placeholder="All Variants"
                    searchPlaceholder="Search variant..."
                    className="w-[200px]"
                    popoverWidth="w-[350px]"
                    disabled={filtersLoading}
                  />
                )}

                {/* Clear button — always visible, disabled when no filter active */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-8 px-2 text-muted-foreground hover:text-foreground"
                  disabled={!advancedFilter && !fruitName && !fruitCountry && !fruitVariant}
                  onClick={() => {
                    setAdvancedFilter('');
                    setFruitName('');
                    setFruitCountry('');
                    setFruitVariant('');
                  }}
                >
                  Clear
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {!advFilteredData.length && isLoading ? (
          <div className="h-80 bg-muted animate-pulse rounded" />
        ) : (
          <div className="space-y-6">
            <div>
              <GroupByChart
                selectedData={selectedData}
                title="Sales Chart"
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-3 shrink-0">
                  <h3 className="text-sm font-semibold">
                    Table ({filteredData.length} row{filteredData.length !== 1 ? 's' : ''})
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {selectedNames.size}/{MAX_SELECTED} selected
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-6 px-2"
                    onClick={handleReset}
                  >
                    Top 10
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-6 px-2"
                    onClick={() => setSelectedNames(new Set())}
                  >
                    Untick All
                  </Button>
                </div>
                <GroupByFilters
                  groupBy={filters.groupBy}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                />
              </div>
              <GroupByTable
                data={filteredData}
                group={filters.groupBy}
                selectedNames={selectedNames}
                onToggle={handleToggle}
                maxSelected={MAX_SELECTED}
                startDate={filters.startDate}
                endDate={filters.endDate}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
