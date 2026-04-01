'use client';

import { useRef } from 'react';

/**
 * Keeps the last non-undefined value of `data` across SWR key changes.
 * Prevents skeleton flash when switching filters — the previous data
 * stays visible until new data arrives.
 *
 * Usage:
 *   const { data: raw, isLoading } = useSWR(key, fetcher);
 *   const data = useStableData(raw);
 *   // `data` is never undefined after the first successful fetch
 */
export function useStableData<T>(data: T | undefined): T | undefined {
  const ref = useRef<T | undefined>(data);
  if (data !== undefined) {
    ref.current = data;
  }
  return data !== undefined ? data : ref.current;
}
