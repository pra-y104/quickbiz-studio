/**
 * Offline indicator.
 *
 * Shows a non-dismissible banner when the browser is offline. Ordinary tools
 * keep working because they are client-side; AI, wallet and payments are
 * disabled by their own fail-closed logic.
 */

import { useOnlineStatus } from '../../lib/offline/use-online-status';
import { cn } from '../../lib/cn';
import { Alert } from './alert';

export function OfflineIndicator({ className }: { className?: string }) {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <Alert
      tone="warning"
      className={cn('fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 z-50', className)}
      title="You are offline"
    >
      Ordinary tools (calculator, word counter, invoice maker, etc.) keep
      working because they run on this device. AI, wallet and payments need a
      network connection and will not work until you are back online.
    </Alert>
  );
}

export default OfflineIndicator;
