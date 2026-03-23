import { format, subDays } from 'date-fns';

export function toSqliteDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export const MYT_EXPR = `datetime(DocDate, '+8 hours')`;

export function getPreviousPeriod(start: string, end: string): { prevStart: string; prevEnd: string } {
  const s = new Date(start);
  const e = new Date(end);
  const lengthMs = e.getTime() - s.getTime() + 86400000;
  const prevEnd = new Date(s.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - lengthMs + 86400000);
  return {
    prevStart: toSqliteDate(prevStart),
    prevEnd: toSqliteDate(prevEnd),
  };
}

export function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = subDays(end, 29);
  return { start: toSqliteDate(start), end: toSqliteDate(end) };
}

/** Full data range for margin dashboard */
export function defaultFullRange(): { start: string; end: string } {
  return { start: '2020-12-01', end: '2025-10-31' };
}
