'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Page Transition Wrapper
 *
 * Adds a subtle fade-in animation when navigating between pages.
 * Uses CSS transitions instead of JS animation libraries for performance.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      const el = containerRef.current;
      if (!el) return;

      el.style.opacity = '0.6';
      const raf = requestAnimationFrame(() => {
        el.style.opacity = '1';
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [pathname]);

  return (
    <div
      ref={containerRef}
      className="transition-opacity duration-200 ease-out"
      style={{ opacity: 1 }}
    >
      {children}
    </div>
  );
}
