import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

export function toSqliteDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** SQLite datetime expression to apply MYT (+8h) offset to a DocDate column */
export const MYT_EXPR = `datetime(DocDate, '+8 hours')`;

/** Get previous period of equal length */
export function getPreviousPeriod(start: string, end: string): { prevStart: string; prevEnd: string } {
  const s = new Date(start);
  const e = new Date(end);
  const lengthMs = e.getTime() - s.getTime() + 86400000; // inclusive
  const prevEnd = new Date(s.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - lengthMs + 86400000);
  return {
    prevStart: toSqliteDate(prevStart),
    prevEnd: toSqliteDate(prevEnd),
  };
}

/** Default date range: last 30 days */
export function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = subDays(end, 29);
  return { start: toSqliteDate(start), end: toSqliteDate(end) };
}
