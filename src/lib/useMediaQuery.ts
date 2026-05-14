'use client';

import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query and returns whether it matches.
 *
 * Returns `false` on the server / first client render so SSR output is
 * deterministic; flips to the real value once mounted. The brief
 * desktop-then-mobile snap is preferable to a hydration mismatch error.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/** Tailwind's `md` breakpoint is 768px; treat anything below as phone. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}
