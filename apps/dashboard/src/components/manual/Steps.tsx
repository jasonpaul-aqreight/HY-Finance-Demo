interface StepProps {
  number: number;
  title: string;
  children: React.ReactNode;
}

export function Step({ number, title, children }: StepProps) {
  return (
    <div className="flex gap-4 relative">
      {/* Vertical line */}
      <div className="flex flex-col items-center">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: '#1F4E79' }}
        >
          {number}
        </div>
        <div className="flex-1 w-px bg-border mt-2" />
      </div>
      {/* Content */}
      <div className="pb-8 pt-0.5">
        <h4 className="text-base font-semibold text-foreground mb-2">{title}</h4>
        <div className="text-sm leading-relaxed text-foreground">{children}</div>
      </div>
    </div>
  );
}

export function Steps({ children }: { children: React.ReactNode }) {
  return <div className="my-5">{children}</div>;
}
