import { useEffect, useRef } from 'react';

let locks = 0;

/**
 * Shared behaviour for modal-like overlays: Esc to close (top-most only), body scroll lock,
 * initial focus (first [data-autofocus] or the panel) and focus restore on close.
 */
export function useOverlay(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    locks++;
    document.body.style.overflow = 'hidden';
    const stackId = locks;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stackId === locks) {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => {
      const panel = panelRef.current;
      const target = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel;
      target?.focus({ preventScroll: true });
    }, 20);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      locks--;
      if (!locks) document.body.style.overflow = '';
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);

  return panelRef;
}
