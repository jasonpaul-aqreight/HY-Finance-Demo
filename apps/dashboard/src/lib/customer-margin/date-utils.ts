import { format, subDays } from 'date-fns';

export function toSqlDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function getPreviousPeriod(start: string, end: string): { prevStart: string; prevEnd: string } {
  const s = new Date(start);
  const e = new Date(end);
  const lengthMs = e.getTime() - s.getTime() + 86400000;
  const prevEnd = new Date(s.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - lengthMs + 86400000);
  return {
    prevStart: toSqlDate(prevStart),
    prevEnd: toSqlDate(prevEnd),
  };
}

export function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = subDays(end, 29);
  return { start: toSqlDate(start), end: toSqlDate(end) };
}

/** Full data range for margin dashboard */
export function defaultFullRange(): { start: string; end: string } {
  return { start: '2020-12-01', end: '2025-10-31' };
}
