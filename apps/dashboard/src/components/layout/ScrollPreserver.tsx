'use client';

import { useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Wraps a scrollable <main> and preserves scroll position
 * when only search params change (i.e. filter updates).
 * Resets scroll on actual page navigation (pathname change).
 */
export function ScrollPreserver({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const prevPathname = useRef(pathname);
  const savedScroll = useRef(0);
  const isRestoring = useRef(false);

  // Track scroll position — only save non-zero values to avoid
  // overwriting when content collapses during re-render
  const handleScroll = useCallback(() => {
    if (isRestoring.current) return;
    const el = ref.current;
    if (el && el.scrollTop > 0) {
      savedScroll.current = el.scrollTop;
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Reset scroll on pathname change
  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      savedScroll.current = 0;
      if (ref.current) ref.current.scrollTop = 0;
    }
  }, [pathname]);

  // Observe DOM mutations to restore scroll after React re-renders
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new MutationObserver(() => {
      if (savedScroll.current > 0 && el.scrollTop !== savedScroll.current) {
        // Only restore if the element is tall enough to scroll to saved position
        if (el.scrollHeight - el.clientHeight >= savedScroll.current) {
          isRestoring.current = true;
          el.scrollTop = savedScroll.current;
          // Allow scroll tracking again after restoration settles
          requestAnimationFrame(() => {
            isRestoring.current = false;
          });
        }
      }
    });

    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <main ref={ref} className={className}>
      {children}
    </main>
  );
}
