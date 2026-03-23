'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useGroupByData } from '@/hooks/sales/useGroupByData';
import { useGroupByFilters } from '@/hooks/sales/useGroupByFilters';
import type { DashboardFiltersV2 } from '@/hooks/sales/useDashboardFiltersV2';
import type { GroupByDimension } from '@/lib/sales/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GroupByChart } from './GroupByChart';
import { GroupByTable } from './GroupByTable';
import { GroupByFilters } from './GroupByFilters';

const MAX_SELECTED = 10;

const GROUP_OPTIONS: { value: GroupByDimension; label: string }[] = [
  { value: 'customer', label: 'Customer' },
  { value: 'customer-type', label: 'Customer Category' },
  { value: 'fruit', label: 'Fruit' },
  { value: 'fruit-country', label: 'Country' },
  { value: 'fruit-variant', label: 'Variant' },
  { value: 'agent', label: 'Sales Agent' },
  { value: 'outlet', label: 'Outlet' },
];

function getDefaultSelection(data: { name: string; total_sales: number }[]): Set<string> {
  const sorted = [...data].sort((a, b) => b.total_sales - a.total_sales);
  return new Set(sorted.slice(0, MAX_SELECTED).map((r) => r.name));
}

interface GroupBySectionProps {
  filters: DashboardFiltersV2;
  setFilters: (updates: Partial<DashboardFiltersV2>) => void;
}

export function GroupBySection({ filters, setFilters }: GroupBySectionProps) {
  const { data, stackedData, isStacked, isLoading } = useGroupByData(filters);
  const {
    searchQuery,
    setSearchQuery,
    dropdownValue,
    setDropdownValue,
    filteredData,
  } = useGroupByFilters(filters.groupBy, data);

  // ─── Selection state ──────────────────────────────────────────────────────
  const [selectedNames, setSelectedNames] = useState<Set<string>>(() => getDefaultSelection(data));

  // Stable fingerprint: groupBy + first item name + data length
  const dataFingerprint = `${filters.groupBy}:${data.length}:${data[0]?.name ?? ''}`;

  // Reset selection when dimension or data changes
  useEffect(() => {
    setSelectedNames(getDefaultSelection(data));
  }, [dataFingerprint]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = useCallback((name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else if (next.size < MAX_SELECTED) {
        next.add(name);
      }
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setSelectedNames(getDefaultSelection(data));
  }, [data]);

  // ─── Derived data for chart (based on selection, NOT table filters) ─────
  const selectedData = useMemo(
    () => data.filter((r) => selectedNames.has(r.name)),
    [data, selectedNames],
  );

  // Sync stacked data with selected rows (not filtered rows)
  const selectedStackedData = useMemo(() => {
    if (!stackedData) return stackedData;
    return stackedData.filter((r) => selectedNames.has(r.primary_name));
  }, [stackedData, selectedNames]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle>Sales Breakdown</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Group by:</span>
            <div className="flex border rounded-md overflow-hidden">
              {GROUP_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={filters.groupBy === opt.value ? 'default' : 'ghost'}
                  className="rounded-none border-0 text-xs px-3 h-7"
                  onClick={() => setFilters({ groupBy: opt.value })}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-80 bg-muted animate-pulse rounded" />
        ) : (
          <div className="space-y-6">
            <div>
              <GroupByChart
                selectedData={selectedData}
                stackedData={selectedStackedData}
                isStacked={isStacked}
                title="Sales Chart"
                groupBy={filters.groupBy}
                stackBy={filters.stackBy}
                onStackChange={(dim) => setFilters({ stackBy: dim })}
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
                    Reset
                  </Button>
                </div>
                <GroupByFilters
                  groupBy={filters.groupBy}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  dropdownValue={dropdownValue}
                  onDropdownChange={setDropdownValue}
                  data={data}
                />
              </div>
              <GroupByTable
                data={filteredData}
                group={filters.groupBy}
                selectedNames={selectedNames}
                onToggle={handleToggle}
                maxSelected={MAX_SELECTED}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
