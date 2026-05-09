'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import {
  TrendingUp,
  CreditCard,
  RotateCcw,
  BarChart3,
  Receipt,
  Users,
  Truck,
  RefreshCw,
  PanelLeftClose,
  PanelLeft,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from './SidebarProvider';
import { useRole } from './RoleProvider';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const navItems = [
  { href: '/sales', label: 'Sales', icon: TrendingUp },
  { href: '/payment', label: 'Payment', icon: CreditCard },
  { href: '/return', label: 'Returns', icon: RotateCcw },
  { href: '/financial', label: 'Financials', icon: BarChart3 },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/customer-margin', label: 'Customer Margin', icon: Users },
  { href: '/supplier-performance', label: 'Supplier Performance', icon: Truck },
];

const resourceItems = [
  { href: '/manual', label: 'User Manual', icon: BookOpen },
];

const adminItems = [
  { href: '/admin/sync', label: 'Data Sync', icon: RefreshCw },
  { href: '/admin/ai-insight-config', label: 'AI Insight Config', icon: Sparkles },
];

interface FeedbackRow {
  id: number;
  targetPromptKey: string;
}

const feedbackFetcher = async (url: string): Promise<{ feedback: FeedbackRow[] }> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
};

export function AppSidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const { isAdmin } = useRole();

  // Total pending feedback count (admin-only). Refresh every 30s so the badge
  // tracks new submissions without manual reload. Skipped when not admin.
  const { data: feedbackData } = useSWR<{ feedback: FeedbackRow[] }>(
    isAdmin ? '/api/admin/ai-insight-feedback' : null,
    feedbackFetcher,
    { refreshInterval: 30_000, revalidateOnFocus: false },
  );
  const totalFeedback = feedbackData?.feedback.length ?? 0;

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-4">
        {!collapsed && (
          <h1 className="text-sm font-bold tracking-tight whitespace-nowrap" style={{ color: '#1F4E79' }}>
            Hoi-Yong Finance
          </h1>
        )}
        <button
          onClick={toggle}
          className="rounded-md p-1.5 hover:bg-sidebar-accent text-sidebar-foreground"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          const link = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger render={<span />}>{link}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}

        {/* Resources section */}
        <div className="pt-3 mt-3 border-t border-sidebar-accent">
          {!collapsed && (
            <span className="px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Resources
            </span>
          )}
          <div className="mt-1 space-y-1">
            {resourceItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;

              const link = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger render={<span />}>{link}</TooltipTrigger>
                    <TooltipContent side="right" sideOffset={10}>
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return link;
            })}
          </div>
        </div>

        {/* Admin section */}
        <div className="pt-3 mt-3 border-t border-sidebar-accent">
          {!collapsed && (
            <span className="px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Admin
            </span>
          )}
          <div className="mt-1 space-y-1">
            {adminItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              const showBadge =
                isAdmin &&
                item.href === '/admin/ai-insight-config' &&
                totalFeedback > 0;

              const link = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {showBadge && (
                    <span
                      className={cn(
                        collapsed
                          ? 'absolute right-1 top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white'
                          : 'ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white'
                      )}
                      title={`${totalFeedback} pending feedback`}
                    >
                      {totalFeedback}
                    </span>
                  )}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger render={<span />}>{link}</TooltipTrigger>
                    <TooltipContent side="right" sideOffset={10}>
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return link;
            })}
          </div>
        </div>
      </nav>
    </aside>
  );
}
