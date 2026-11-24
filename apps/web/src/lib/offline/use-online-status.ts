/**
 * Hook that tracks the browser's online/offline state.
 *
 * Returns true when the browser believes it has a network connection. This is
 * a heuristic: navigator.onLine can be true even when there is no usable
 * connectivity (captive portals, etc.). It is used only for the offline
 * indicator UI, never to gate functionality.
 */

import { useCallback, useEffect, useState } from 'react';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  const handleOnline = useCallback(() => setOnline(true), []);
  const handleOffline = useCallback(() => setOnline(false), []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return online;
}
