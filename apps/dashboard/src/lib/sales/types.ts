// Shared types and constants for sales queries — safe to import from client components

export type GroupByDimension = 'customer' | 'customer-type' | 'agent' | 'outlet' | 'fruit';

export interface GroupByRow {
  name: string;
  total_sales: number;
  invoice_sales: number;
  cash_sales: number;
  credit_notes: number;
  doc_count: number;
  [key: string]: string | number | null;
}
