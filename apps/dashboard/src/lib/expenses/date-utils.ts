import { format, subDays } from 'date-fns';

export function toSqlDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
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
