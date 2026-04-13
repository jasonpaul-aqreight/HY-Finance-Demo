'use client';

import { Info, Lightbulb, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const variants = {
  tip: {
    icon: Lightbulb,
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    title: 'Tip',
  },
  info: {
    icon: Info,
    border: 'border-l-blue-500',
    bg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    title: 'Note',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-l-amber-500',
    bg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    title: 'Important',
  },
  insight: {
    icon: Lightbulb,
    border: 'border-l-violet-500',
    bg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    title: 'Why should you care?',
  },
};

interface CalloutProps {
  type?: keyof typeof variants;
  title?: string;
  children: React.ReactNode;
}

export function Callout({ type = 'info', title, children }: CalloutProps) {
  const v = variants[type];
  const Icon = v.icon;

  return (
    <div
      className={cn(
        'my-5 rounded-r-lg border-l-4 px-5 py-4',
        v.border,
        v.bg
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} className={cn('shrink-0', v.iconColor)} />
        <span className={cn('text-sm font-semibold', v.iconColor)}>
          {title || v.title}
        </span>
      </div>
      <div className="text-sm leading-relaxed text-foreground">{children}</div>
    </div>
  );
}
