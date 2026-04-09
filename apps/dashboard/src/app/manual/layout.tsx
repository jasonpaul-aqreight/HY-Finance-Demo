'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  Search,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { searchWiki, type SearchEntry } from './search-index';

interface WikiPage {
  href: string;
  label: string;
}

interface WikiSection {
  title: string;
  items: (WikiPage | { title: string; items: WikiPage[] })[];
}

const wikiTree: WikiSection[] = [
  {
    title: 'General',
    items: [
      { href: '/manual/general/date-range', label: 'How to Change the Date Range' },
      { href: '/manual/general/export-excel', label: 'How to Export to Excel' },
      { href: '/manual/general/sort-filter', label: 'How to Sort and Filter Tables' },
      { href: '/manual/general/read-charts', label: 'How to Read Charts' },
      { href: '/manual/general/number-formats', label: 'Understanding Number Formats' },
      { href: '/manual/general/ai-insight', label: 'How to Use AI Insight' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { href: '/manual/admin/sync-data', label: 'How to Sync Data' },
      { href: '/manual/admin/sync-timing', label: 'Sync Timing and Freshness' },
      {
        title: 'Settings',
        items: [
          { href: '/manual/admin/settings-payment', label: 'Payment Settings' },
        ],
      },
    ],
  },
  {
    title: 'Finance',
    items: [
      {
        title: 'Sales',
        items: [
          { href: '/manual/finance/sales/overview', label: 'Overview' },
          { href: '/manual/finance/sales/metrics', label: 'Net Sales, Invoice, Cash & Credit Notes' },
          { href: '/manual/finance/sales/trend-chart', label: 'Sales Trend Chart' },
          { href: '/manual/finance/sales/breakdown', label: 'Sales Breakdown (Group By)' },
          { href: '/manual/finance/sales/customer-profile', label: 'Customer Profile Popup' },
        ],
      },
      { href: '/manual/finance/payment', label: 'Payment Collection' },
      { href: '/manual/finance/return', label: 'Returns' },
      { href: '/manual/finance/financial', label: 'Financial Statements' },
      { href: '/manual/finance/expenses', label: 'Expenses' },
      { href: '/manual/finance/customer-margin', label: 'Customer Margin' },
      { href: '/manual/finance/supplier-performance', label: 'Supplier Performance' },
    ],
  },
];

// getAllPages no longer needed — using searchWiki for full-text search

function TreeItem({
  item,
  pathname,
  searchQuery,
}: {
  item: WikiPage | { title: string; items: WikiPage[] };
  pathname: string;
  searchQuery: string;
}) {
  const [open, setOpen] = useState(true);

  if ('href' in item) {
    if (searchQuery && !item.label.toLowerCase().includes(searchQuery)) return null;
    const isActive = pathname === item.href;
    return (
      <li>
        <Link
          href={item.href}
          className={cn(
            'block rounded-md px-2 py-1 text-[13px] transition-colors',
            isActive
              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
              : 'text-foreground/70 hover:bg-sidebar-accent/50 hover:text-foreground'
          )}
        >
          {item.label}
        </Link>
      </li>
    );
  }

  // Subsection with children
  const filteredItems = searchQuery
    ? item.items.filter((i) => i.label.toLowerCase().includes(searchQuery))
    : item.items;
  if (searchQuery && filteredItems.length === 0) return null;

  return (
    <li>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-[13px] font-medium text-foreground/80 hover:bg-sidebar-accent/50 transition-colors"
      >
        {item.title}
        <ChevronDown
          size={12}
          className={cn(
            'text-foreground/40 transition-transform',
            !open && '-rotate-90'
          )}
        />
      </button>
      {open && (
        <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2">
          {filteredItems.map((child) => (
            <TreeItem
              key={child.href}
              item={child}
              pathname={pathname}
              searchQuery={searchQuery}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function ManualLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const searchQuery = search.toLowerCase();

  // Full-text search across all article content
  const searchResults: SearchEntry[] | null = useMemo(() => {
    if (!searchQuery) return null;
    return searchWiki(search);
  }, [search, searchQuery]);

  return (
    <div className="flex h-full">
      {/* Wiki sidebar */}
      <nav className="w-60 shrink-0 border-r bg-card flex flex-col">
        <div className="p-4 pb-2">
          <Link href="/manual">
            <h2
              className="text-sm font-bold uppercase tracking-wider"
              style={{ color: '#1F4E79' }}
            >
              Wiki
            </h2>
          </Link>
        </div>

        {/* Search */}
        <div className="px-3 pb-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground/40"
            />
            <input
              type="text"
              placeholder="Search all articles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
        </div>

        {/* Search results or tree */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {searchResults ? (
            <div>
              <span className="px-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/40">
                {searchResults.length} result{searchResults.length !== 1 && 's'}
              </span>
              <ul className="mt-1.5 space-y-0.5">
                {searchResults.map((entry) => {
                  const isActive = pathname === entry.href;
                  return (
                    <li key={entry.href}>
                      <Link
                        href={entry.href}
                        onClick={() => setSearch('')}
                        className={cn(
                          'block rounded-md px-2 py-1.5 transition-colors',
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'text-foreground/70 hover:bg-sidebar-accent/50 hover:text-foreground'
                        )}
                      >
                        <span className="block text-[13px] font-medium">{entry.title}</span>
                        <span className="block text-[11px] text-foreground/40">{entry.section}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            wikiTree.map((section) => (
              <div key={section.title} className="mb-3">
                <span className="px-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/40">
                  {section.title}
                </span>
                <ul className="mt-1 space-y-0.5">
                  {section.items.map((item, i) => (
                    <TreeItem
                      key={'href' in item ? item.href : item.title + i}
                      item={item}
                      pathname={pathname}
                      searchQuery={searchQuery}
                    />
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </nav>

      {/* Wiki content */}
      <div className="manual-content flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
