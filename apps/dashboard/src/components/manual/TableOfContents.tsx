'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface TocItem {
  id: string;
  label: string;
}

export function TableOfContents({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px' }
    );

    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className="hidden xl:block w-52 shrink-0">
      <div className="sticky top-8">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/50">
          On this page
        </h4>
        <ul className="space-y-1.5 border-l border-border">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={cn(
                  'block border-l-2 -ml-px pl-3 text-xs leading-relaxed transition-colors',
                  activeId === item.id
                    ? 'border-foreground text-foreground font-medium'
                    : 'border-transparent text-foreground/50 hover:text-foreground/80'
                )}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
