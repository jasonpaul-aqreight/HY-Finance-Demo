import { getDb } from './db';

export const MYT_OFFSET = "+8 hours";

let _refDate: string | null = null;

/** Get the reference date (max DocDate from ar_invoice, MYT-adjusted) */
export function getReferenceDate(): string {
  if (!_refDate) {
    const db = getDb();
    const row = db.prepare(`
      SELECT MAX(DATE(DocDate, '+8 hours')) AS ref_date
      FROM ar_invoice WHERE Cancelled = 'F'
    `).get() as { ref_date: string };
    _refDate = row.ref_date;
  }
  return _refDate;
}

/** Get YYYY-MM for a date string */
export function toYearMonth(date: string): string {
  return date.substring(0, 7);
}

/** Get first day of month for a date string */
export function monthStart(date: string): string {
  return date.substring(0, 7) + '-01';
}

/** Get last day of month for a YYYY-MM string */
export function monthEnd(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
}

/** Get array of YYYY-MM strings for the last N months relative to a date */
export function getMonthsBack(refDate: string, count: number): string[] {
  const [y, m] = refDate.substring(0, 7).split('-').map(Number);
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push(ym);
  }
  return months;
}

/** Get prior month's YYYY-MM given a YYYY-MM */
export function priorMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Number of days in a month given YYYY-MM */
export function daysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
