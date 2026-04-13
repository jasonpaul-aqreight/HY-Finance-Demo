'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccordionItemProps {
  question: string;
  children: React.ReactNode;
}

export function AccordionItem({ question, children }: AccordionItemProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-4 text-left text-sm font-semibold text-foreground hover:text-foreground/80 transition-colors"
      >
        {question}
        <ChevronDown
          size={16}
          className={cn(
            'shrink-0 text-foreground/50 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && (
        <div className="pb-4 text-sm leading-relaxed text-foreground">
          {children}
        </div>
      )}
    </div>
  );
}

export function Accordion({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="my-5 rounded-xl border bg-card ring-1 ring-foreground/10">
      {title && (
        <div className="border-b px-5 py-3">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
      )}
      <div className="px-5">{children}</div>
    </div>
  );
}
