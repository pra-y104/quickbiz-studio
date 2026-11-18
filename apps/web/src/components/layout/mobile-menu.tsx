import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, LayoutDashboard, LogIn, UserPlus, X } from 'lucide-react';
import { Link } from 'react-router';
import { HOMEPAGE_NAV } from '../../content/homepage';
import { useAuth } from '../../lib/auth/auth-context';
import { Logo } from '../brand/logo';
import { Button } from '../ui/button';
import { ThemeToggle } from '../ui/theme-toggle';

export interface MobileMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Mobile navigation drawer.
 *
 * Split into its own module so the dialog runtime is not part of the initial
 * homepage bundle; the header warms this chunk during idle time and mounts it on
 * first open.
 */
export function MobileMenu({ open, onOpenChange }: MobileMenuProps) {
  const { session } = useAuth();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[88%] max-w-sm flex-col border-l border-border bg-surface p-5 shadow-elev-3">
          <div className="flex items-center justify-between">
            <Logo />
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" aria-label="Close navigation menu">
                <X className="size-5" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <Dialog.Description className="sr-only">
            Jump to a section of the QuickBiz Studio homepage.
          </Dialog.Description>

          <nav aria-label="Mobile" className="mt-8 flex flex-col gap-1">
            {HOMEPAGE_NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-ink transition-colors hover:bg-surface-muted"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="mt-auto space-y-4 border-t border-border pt-5">
            {session ? (
              <Button asChild className="w-full">
                <Link to="/dashboard" onClick={() => onOpenChange(false)}>
                  <LayoutDashboard className="size-4" aria-hidden="true" />
                  Go to dashboard
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild className="w-full">
                  <Link to="/register" onClick={() => onOpenChange(false)}>
                    <UserPlus className="size-4" aria-hidden="true" />
                    Create an account
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/login" onClick={() => onOpenChange(false)}>
                    <LogIn className="size-4" aria-hidden="true" />
                    Sign in
                  </Link>
                </Button>
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-subtle">Colour theme</span>
              <ThemeToggle />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
