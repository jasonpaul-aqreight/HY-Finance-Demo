// Shared types and constants for sales queries — safe to import from client components

export type GroupByDimension = 'customer' | 'customer-type' | 'agent' | 'outlet' | 'fruit' | 'fruit-country' | 'fruit-variant';

export type StackDimension = 'agent' | 'fruit' | 'outlet' | 'customer-type' | 'fruit-country';

export const STACK_OPTIONS: Record<GroupByDimension, StackDimension[]> = {
  'customer':      ['agent', 'fruit', 'fruit-country', 'outlet'],
  'customer-type': ['agent', 'fruit', 'fruit-country'],
  'fruit':         ['customer-type'],
  'fruit-country': ['fruit'],
  'fruit-variant': ['customer-type'],
  'agent':         ['fruit', 'fruit-country', 'outlet'],
  'outlet':        ['fruit-country', 'fruit'],
};

export interface GroupByRow {
  name: string;
  total_sales: number;
  invoice_sales: number;
  cash_sales: number;
  credit_notes: number;
  doc_count: number;
  [key: string]: string | number | null;
}

export interface StackedRow {
  primary_name: string;
  stack_name: string;
  total_sales: number;
}
