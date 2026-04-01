import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

export function toSqlDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Convert YYYY-MM-DD date string to YYYY-MM month key for pc_* table queries */
export function toMonth(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** Get previous period of equal length */
export function getPreviousPeriod(start: string, end: string): { prevStart: string; prevEnd: string } {
  const s = new Date(start);
  const e = new Date(end);
  const lengthMs = e.getTime() - s.getTime() + 86400000; // inclusive
  const prevEnd = new Date(s.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - lengthMs + 86400000);
  return {
    prevStart: toSqlDate(prevStart),
    prevEnd: toSqlDate(prevEnd),
  };
}

/** Default date range: last 30 days */
export function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = subDays(end, 29);
  return { start: toSqlDate(start), end: toSqlDate(end) };
}
