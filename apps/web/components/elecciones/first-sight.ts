'use client';

import { useEffect, useRef } from 'react';

// Hace `run` la primera vez que el elemento se ve en buena parte (para las animaciones de entrada).
export function useFirstSight(run: () => void, threshold: number) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(run);
  latest.current = run;
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.intersectionRatio >= threshold)) return;
        observer.disconnect();
        latest.current();
      },
      { threshold: [threshold] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);
  return ref;
}
