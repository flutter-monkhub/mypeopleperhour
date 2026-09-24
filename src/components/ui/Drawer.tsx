import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useOverlay } from './overlay';

const WIDTHS = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-xl', xl: 'max-w-3xl' } as const;

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Extra header content under the title (tabs, badges) */
  header?: ReactNode;
  footer?: ReactNode;
  width?: keyof typeof WIDTHS;
  children?: ReactNode;
}

/** Right-side sheet for details/edit forms. */
export function Drawer({ open, onClose, title, subtitle, header, footer, width = 'md', children }: DrawerProps) {
  const panelRef = useOverlay(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70]" role="presentation">
      <div className="absolute inset-0 animate-fade-in bg-[rgba(15,23,42,.35)]" onClick={onClose} aria-hidden />
      <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1} className={cn('absolute inset-y-0 right-0 flex w-full animate-slide-in-right flex-col bg-white shadow-pop outline-none', WIDTHS[width])}>
        <div className="border-b border-line px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {title && <h2 className="text-lg leading-7 font-semibold text-ink">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} className="-mr-2 grid size-8 place-items-center rounded-lg text-muted hover:bg-neutral-soft hover:text-ink" aria-label="Close">
              <X className="size-4.5" />
            </button>
          </div>
          {header && <div className="mt-3">{header}</div>}
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-canvas/60 px-6 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
