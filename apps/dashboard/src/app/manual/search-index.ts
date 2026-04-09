/**
 * Full-text search index for wiki articles.
 * Each entry contains the article's searchable text content.
 * Update this when adding or modifying wiki articles.
 */

export interface SearchEntry {
  href: string;
  title: string;
  section: string;
  content: string; // full text for searching
}

export const searchIndex: SearchEntry[] = [
  // ── General ──
  {
    href: '/manual/general/date-range',
    title: 'How to Change the Date Range',
    section: 'General',
    content:
      'date range filter date picker month start end quick presets 3M 6M 12M YTD year-to-date time period camera lens default last 12 months everything updates KPI cards trend chart breakdown table custom range Nov Oct selected period',
  },
  {
    href: '/manual/general/export-excel',
    title: 'How to Export to Excel',
    section: 'General',
    content:
      'export excel download spreadsheet xlsx table data button top right filters sorting current data export respects active filters apply filters before exporting',
  },
  {
    href: '/manual/general/sort-filter',
    title: 'How to Sort and Filter Tables',
    section: 'General',
    content:
      'sort filter table column header ascending descending search box find specific rows dropdown filters customer category clear reset all filters checkbox select items pagination page size 25 50 100 rows Top 10 Untick All',
  },
  {
    href: '/manual/general/read-charts',
    title: 'How to Read Charts',
    section: 'General',
    content:
      'charts bar chart line chart hover tooltip exact value large numbers abbreviated K thousands M millions daily weekly monthly toggle granularity legend colour color segment stacked',
  },
  {
    href: '/manual/general/number-formats',
    title: 'Understanding Number Formats',
    section: 'General',
    content:
      'number format RM Malaysian Ringgit currency K thousands 500K M millions 1.2M negative values red credit notes no decimal places abbreviation',
  },

  {
    href: '/manual/general/ai-insight',
    title: 'How to Use AI Insight',
    section: 'General',
    content:
      'AI insight engine analyze analysis get insight positive negative panel summary detail dialog component metric KPI chart table payment sales trend breakdown collection rate collection days analyst report cancel do not navigate stay on page one at a time results saved date range cost tokens',
  },

  // ── Admin ──
  {
    href: '/manual/admin/sync-data',
    title: 'How to Sync Data',
    section: 'Admin',
    content:
      'sync data AutoCount accounting system PostgreSQL database data flows pull latest records manual sync trigger Sync Now Data Sync admin minutes',
  },
  {
    href: '/manual/admin/sync-timing',
    title: 'Sync Timing and Freshness',
    section: 'Admin',
    content:
      'sync timing freshness indicator last synced data stale outdated schedule regular 24 hours administrator contact refresh',
  },
  {
    href: '/manual/admin/settings-payment',
    title: 'Payment Settings',
    section: 'Admin',
    content:
      'payment settings credit terms payment scoring thresholds customer credit score configure payment collection dashboard-wide impact',
  },

  // ── Finance > Sales ──
  {
    href: '/manual/finance/sales/overview',
    title: 'Sales Report — Overview',
    section: 'Sales',
    content:
      'sales report overview how much money coming in most important page revenue tracking daily weekly monthly KPI cards trend chart sales breakdown three sections top line',
  },
  {
    href: '/manual/finance/sales/metrics',
    title: 'Net Sales, Invoice, Cash & Credit Notes',
    section: 'Sales',
    content:
      'net sales invoice sales cash sales credit notes KPI cards key performance indicator formula Invoice Sales plus Cash Sales minus Credit Notes revenue actual revenue headline number management 95% credit terms 6% immediate payment POS point of sale returns refunds adjustments red reduces revenue perishable goods RM 88 million bread and butter zero risk non-payment',
  },
  {
    href: '/manual/finance/sales/trend-chart',
    title: 'Sales Trend Chart',
    section: 'Sales',
    content:
      'net sales trend chart stacked bar chart time period daily weekly monthly blue invoice sales green cash sales red credit notes below zero line axes horizontal vertical RM abbreviated K M patterns growth decline seasonal dip granularity toggle hover tooltip',
  },
  {
    href: '/manual/finance/sales/breakdown',
    title: 'Sales Breakdown (Group By)',
    section: 'Sales',
    content:
      'sales breakdown group by customer product sales agent outlet horizontal bar chart top 10 data table search sort checkboxes maximum 10 Top 10 button Untick All Export Excel pagination 25 50 100 rows filter category country variant active inactive dropdown clear who what where actionable insights concentration risk',
  },
  {
    href: '/manual/finance/sales/customer-profile',
    title: 'Customer Profile Popup',
    section: 'Sales',
    content:
      'customer profile popup modal click customer name blue link payment health return history monthly sales trend individual customer performance deep dive investigating declining purchases returns unusually high',
  },

  // ── Finance (placeholders) ──
  {
    href: '/manual/finance/payment',
    title: 'Payment Collection',
    section: 'Finance',
    content:
      'payment collection outstanding payments aging buckets credit utilization customer payment health days sales outstanding DSO credit score coming soon',
  },
  {
    href: '/manual/finance/return',
    title: 'Returns',
    section: 'Finance',
    content:
      'returns credit notes refunds return trends goods returned adjustments coming soon',
  },
  {
    href: '/manual/finance/financial',
    title: 'Financial Statements',
    section: 'Finance',
    content:
      'financial statements profit loss P&L balance sheet income statement revenue expenses profitable coming soon',
  },
  {
    href: '/manual/finance/expenses',
    title: 'Expenses',
    section: 'Finance',
    content:
      'expenses where money going cost categories spending breakdown coming soon',
  },
  {
    href: '/manual/finance/customer-margin',
    title: 'Customer Margin',
    section: 'Finance',
    content:
      'customer margin profitability per customer gross margin percentage revenue COGS cost of goods sold coming soon',
  },
  {
    href: '/manual/finance/supplier-performance',
    title: 'Supplier Performance',
    section: 'Finance',
    content:
      'supplier performance supplier margin best margins buying smart cost efficiency coming soon',
  },
];

export function searchWiki(query: string): SearchEntry[] {
  if (!query.trim()) return [];
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return searchIndex
    .map((entry) => {
      const haystack = `${entry.title} ${entry.content}`.toLowerCase();
      const matches = terms.filter((term) => haystack.includes(term));
      return { entry, score: matches.length };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ entry }) => entry);
}
