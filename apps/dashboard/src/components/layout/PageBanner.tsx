import type { ReactNode } from 'react';

export function PageBanner({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="border-b bg-card px-6 py-4">
      <div className="max-w-[1600px] mx-auto flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-base text-muted-foreground mt-1">{description}</p>
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
