import { cn } from '@/lib/utils';

interface MetricCardProps {
  name: string;
  formula?: string;
  description: string;
  color?: string;
  children?: React.ReactNode;
}

export function MetricCard({
  name,
  formula,
  description,
  color = '#1F4E79',
  children,
}: MetricCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex items-center gap-2 mb-3">
        <div
          className="size-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <h4 className="text-base font-semibold text-foreground">{name}</h4>
      </div>
      {formula && (
        <div className="mb-3 rounded-md bg-muted/60 px-3 py-2 text-sm font-mono text-foreground">
          {formula}
        </div>
      )}
      <p className="text-sm leading-relaxed text-foreground">{description}</p>
      {children && (
        <div className="mt-3 text-sm leading-relaxed text-foreground">
          {children}
        </div>
      )}
    </div>
  );
}

export function MetricGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 grid gap-4 sm:grid-cols-2">{children}</div>
  );
}
