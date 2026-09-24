import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  tone?: ToastTone;
  title: string;
  message?: string;
  /** ms, default 4000 (errors 6000). 0 = sticky */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
}

const useToastStore = create<{ toasts: ToastItem[] }>(() => ({ toasts: [] }));
let seq = 0;

function show(opts: ToastOptions): number {
  const id = ++seq;
  useToastStore.setState((s) => ({ toasts: [...s.toasts.slice(-3), { tone: 'info', ...opts, id }] }));
  return id;
}

export function dismissToast(id: number) {
  useToastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

/**
 * Global toast API — callable anywhere (actions, event handlers):
 *   toast.success('Session updated')  ·  toast.error('Could not save', 'Try again')
 */
export const toast = {
  show,
  success: (title: string, message?: string) => show({ tone: 'success', title, message }),
  error: (title: string, message?: string) => show({ tone: 'error', title, message, duration: 6000 }),
  info: (title: string, message?: string) => show({ tone: 'info', title, message }),
  warning: (title: string, message?: string) => show({ tone: 'warning', title, message }),
  dismiss: dismissToast,
};

/** Hook form: `const toast = useToast(); toast.success('Saved')` */
export const useToast = () => toast;

const TONES: Record<ToastTone, { icon: typeof Info; cls: string }> = {
  success: { icon: CircleCheck, cls: 'text-success' },
  error: { icon: CircleAlert, cls: 'text-danger' },
  info: { icon: Info, cls: 'text-primary' },
  warning: { icon: TriangleAlert, cls: 'text-warning' },
};

function ToastView({ t }: { t: ToastItem }) {
  const { icon: Icon, cls } = TONES[t.tone ?? 'info'];
  useEffect(() => {
    const d = t.duration ?? (t.tone === 'error' ? 6000 : 4000);
    if (!d) return;
    const timer = setTimeout(() => dismissToast(t.id), d);
    return () => clearTimeout(timer);
  }, [t]);
  return (
    <div role={t.tone === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex w-full animate-toast-in items-start gap-3 rounded-xl border border-line bg-white p-3.5 pr-2.5 shadow-pop">
      <Icon className={cn('mt-0.5 size-5 shrink-0', cls)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{t.title}</p>
        {t.message && <p className="mt-0.5 text-[13px] text-ink-2">{t.message}</p>}
        {t.action && (
          <button
            type="button"
            className="mt-1.5 text-[13px] font-semibold text-primary hover:underline"
            onClick={() => {
              t.action?.onClick();
              dismissToast(t.id);
            }}
          >
            {t.action.label}
          </button>
        )}
      </div>
      <button type="button" onClick={() => dismissToast(t.id)} className="grid size-6 shrink-0 place-items-center rounded-md text-muted hover:bg-neutral-soft hover:text-ink" aria-label="Dismiss">
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/** Mounted once in App (bottom-right stack). */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return createPortal(
    <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <ToastView key={t.id} t={t} />
      ))}
    </div>,
    document.body,
  );
}
