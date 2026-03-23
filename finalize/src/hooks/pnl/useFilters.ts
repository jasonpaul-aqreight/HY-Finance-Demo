'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export interface FiscalYearOption {
  FiscalYearName: string;
  FromDate: string;
  ToDate: string;
  IsActive: string;
}

export interface ProjectOption {
  ProjNo: string;
  Description: string;
  IsActive: string;
}

export function useFiscalYears() {
  return useSWR<FiscalYearOption[]>('/api/pnl/filters/fiscal-years', fetcher);
}

export function useProjects() {
  return useSWR<ProjectOption[]>('/api/pnl/filters/projects', fetcher);
}
