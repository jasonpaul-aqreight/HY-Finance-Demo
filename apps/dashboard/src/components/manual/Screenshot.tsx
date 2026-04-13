/* eslint-disable @next/next/no-img-element */

interface ScreenshotProps {
  src: string;
  alt: string;
  caption?: string;
}

export function Screenshot({ src, alt, caption }: ScreenshotProps) {
  return (
    <figure className="my-6">
      <div className="overflow-hidden rounded-lg border bg-muted/30 ring-1 ring-foreground/5">
        <img
          src={src}
          alt={alt}
          className="w-full"
          loading="lazy"
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-sm text-foreground/70">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
