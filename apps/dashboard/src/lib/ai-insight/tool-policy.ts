import type Anthropic from '@anthropic-ai/sdk';
import { AI_TOOLS } from './tools';
import type { SectionKey } from './types';

export type ToolPolicy = 'none' | 'aggregate_only' | 'full';

const SECTION_POLICY: Record<SectionKey, ToolPolicy> = {
  payment_collection_trend: 'none',
  payment_outstanding: 'full',
  sales_trend: 'aggregate_only',
  sales_breakdown: 'full',
  customer_margin_overview: 'aggregate_only',
  customer_margin_breakdown: 'full',
  supplier_margin_overview: 'aggregate_only',
  supplier_margin_breakdown: 'full',
  return_trend: 'aggregate_only',
  return_unsettled: 'full',
};

const AGGREGATE_LOCAL_TABLES = new Set([
  'pc_sales_daily',
  'pc_ar_monthly',
  'pc_ar_aging_history',
  'pc_customer_margin',
  'pc_supplier_margin',
  'pc_return_monthly',
  'pc_return_products',
]);

export function policyForSection(sectionKey: SectionKey): ToolPolicy {
  return SECTION_POLICY[sectionKey] ?? 'full';
}

export function toolsForSection(sectionKey: SectionKey): Anthropic.Tool[] {
  const policy = policyForSection(sectionKey);
  if (policy === 'none') return [];
  if (policy === 'full') return AI_TOOLS;

  return AI_TOOLS
    .filter(t => t.name === 'query_local_table')
    .map(t => {
      const props = (t.input_schema as { properties: { table: { enum: string[] } } }).properties;
      const restrictedTables = props.table.enum.filter(name => AGGREGATE_LOCAL_TABLES.has(name));
      return {
        ...t,
        description: `${t.description}\n\n[POLICY: aggregate_only — only these tables allowed: ${restrictedTables.join(', ')}]`,
        input_schema: {
          ...t.input_schema,
          properties: {
            ...props,
            table: { ...props.table, enum: restrictedTables },
          },
        },
      } as Anthropic.Tool;
    });
}

export function validateToolForSection(
  sectionKey: SectionKey,
  toolName: string,
  input: { table?: string },
): string | null {
  const policy = policyForSection(sectionKey);
  if (policy === 'full') return null;
  if (policy === 'none') return `Tool ${toolName} is not allowed for section ${sectionKey} (policy: none).`;

  if (toolName !== 'query_local_table') {
    return `Tool ${toolName} is not allowed for section ${sectionKey} (policy: aggregate_only — only query_local_table on aggregate tables is permitted).`;
  }
  const table = input.table ?? '';
  if (!AGGREGATE_LOCAL_TABLES.has(table)) {
    return `Table ${table} is not allowed for section ${sectionKey} (policy: aggregate_only). Allowed tables: ${[...AGGREGATE_LOCAL_TABLES].join(', ')}.`;
  }
  return null;
}
