export function PageBanner({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b bg-card px-6 py-4">
      <div className="max-w-[1600px] mx-auto">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-base text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
}
