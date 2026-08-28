'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes

export default function InactivityTracker() {
  let router: ReturnType<typeof useRouter> | null = null;
  let pathname: string | null = null;

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    pathname = usePathname();
  } catch {
    // Graceful fallback during isolated unit testing
  }

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (pathname === '/login') {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const handleInactivityLogout = async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {
        // Proceed
      }
      if (router) {
        router.push('/login?reason=inactivity');
        router.refresh();
      } else if (typeof window !== 'undefined' && window.location) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/login?reason=inactivity';
      }
    };

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(handleInactivityLogout, INACTIVITY_LIMIT_MS);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));

    // Start initial timer
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [pathname, router]);

  return null;
}
