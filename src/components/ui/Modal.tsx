import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useOverlay } from './overlay';

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const;
const ICON_TONES = {
  primary: 'bg-primary-soft text-primary',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  success: 'bg-success-soft text-success',
  mentor: 'bg-mentor-soft text-mentor',
} as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  iconTone?: keyof typeof ICON_TONES;
  size?: keyof typeof SIZES;
  /** Sticky footer (buttons are right-aligned) */
  footer?: ReactNode;
  /** Close when clicking the backdrop (default true) */
  dismissible?: boolean;
  hideClose?: boolean;
  className?: string;
  children?: ReactNode;
}

/** Centered dialog rendered in a portal. Esc/backdrop close, scroll lock, focus handling. */
export function Modal({ open, onClose, title, description, icon: Icon, iconTone = 'primary', size = 'md', footer, dismissible = true, hideClose, className, children }: ModalProps) {
  const panelRef = useOverlay(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center" role="presentation">
      <div className="absolute inset-0 animate-fade-in bg-[rgba(15,23,42,.45)] backdrop-blur-[2px]" onClick={dismissible ? onClose : undefined} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn('relative flex max-h-[calc(100vh-2rem)] w-full animate-pop-in flex-col rounded-2xl bg-white shadow-pop outline-none', SIZES[size], className)}
      >
        {(title || !hideClose) && (
          <div className="flex items-start gap-3 px-6 pt-5 pb-1">
            {Icon && (
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', ICON_TONES[iconTone])}>
                <Icon className="size-5" />
              </span>
            )}
            <div className="min-w-0 flex-1 pt-0.5">
              {title && <h2 className="text-lg leading-7 font-semibold text-ink">{title}</h2>}
              {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
            </div>
            {!hideClose && (
              <button type="button" onClick={onClose} className="-mr-2 grid size-8 place-items-center rounded-lg text-muted hover:bg-neutral-soft hover:text-ink" aria-label="Close">
                <X className="size-4.5" />
              </button>
            )}
          </div>
        )}
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-line bg-canvas/60 px-6 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
