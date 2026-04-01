'use client';

import { useState, useCallback, useEffect } from 'react';
import { useFiscalYears } from './useFilters';
import type { V3DashboardFilters, V3Range } from '@/types/pnl-v3';

export function useDashboardFiltersV3() {
  const { data: fiscalYears } = useFiscalYears();
  const [filters, setFiltersState] = useState<V3DashboardFilters>({
    fiscalYear: '',
    range: 'fy',
  });

  useEffect(() => {
    if (fiscalYears && fiscalYears.length > 0 && !filters.fiscalYear) {
      // Default to the second latest FY (most likely to have complete data)
      const target = fiscalYears.length > 1 ? fiscalYears[1] : fiscalYears[0];
      const match = target.FiscalYearName.match(/(\d{4})/);
      const fyKey = match ? `FY${match[1]}` : target.FiscalYearName;
      setFiltersState(prev => ({ ...prev, fiscalYear: fyKey }));
    }
  }, [fiscalYears, filters.fiscalYear]);

  const setFilters = useCallback((updates: Partial<V3DashboardFilters>) => {
    setFiltersState(prev => ({ ...prev, ...updates }));
  }, []);

  return { filters, setFilters };
}
