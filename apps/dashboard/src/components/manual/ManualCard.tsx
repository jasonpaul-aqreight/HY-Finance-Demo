import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface ManualCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

export function ManualCard({ href, icon: Icon, title, description }: ManualCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border bg-card p-6 ring-1 ring-foreground/10 transition-all hover:ring-2 hover:ring-foreground/20 hover:shadow-md"
    >
      <div
        className="mb-4 flex size-10 items-center justify-center rounded-lg text-white"
        style={{ backgroundColor: '#1F4E79' }}
      >
        <Icon size={20} />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1 group-hover:underline">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-foreground/80">{description}</p>
    </Link>
  );
}

export function ManualCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  );
}
