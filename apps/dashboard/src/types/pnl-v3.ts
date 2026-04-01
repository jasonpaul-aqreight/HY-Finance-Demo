// --- V3 API Response Types ------------------------------------------------

// Re-export types shared with V2 (P&L)
export type {
  V2KpiData as V3KpiData,
  V2MonthlyRow as V3MonthlyRow,
  V2MonthlyResponse as V3MonthlyResponse,
  V2StatementAccount as V3StatementAccount,
  V2StatementGroup as V3StatementGroup,
  V2StatementResponse as V3StatementResponse,
  V2YoYLineItem as V3YoYLineItem,
} from './pnl-v2';

// Re-export BS types from V1
export type {
  BSSnapshotResponse as V3BSSnapshotResponse,
  BSTrendRow as V3BSTrendRow,
} from '@/lib/pnl/queries';

// V3 range type
export type V3Range = 'fy' | 'last12' | 'ytd';

// V3 filter state
export interface V3DashboardFilters {
  fiscalYear: string;
  range: V3Range;
}
