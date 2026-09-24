import { useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { CircleHelp, TriangleAlert } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** May return a promise — the confirm button shows a spinner until it settles */
  onConfirm: () => void | Promise<void>;
  title: ReactNode;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  children?: ReactNode;
}

/** Controlled confirmation dialog. Every destructive action must go through this (SPEC §4). */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'primary', children }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      size="sm"
      title={title}
      icon={tone === 'danger' ? TriangleAlert : CircleHelp}
      iconTone={tone === 'danger' ? 'danger' : 'primary'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={run} loading={busy} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message && <div className="text-sm leading-relaxed text-ink-2">{message}</div>}
      {children}
    </Modal>
  );
}

// ───────────── imperative API: const ok = await confirm({ … }) ─────────────

export interface ConfirmOptions {
  title: ReactNode;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

interface ConfirmState {
  request: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
}

const useConfirmStore = create<ConfirmState>(() => ({ request: null }));

/** Promise-based confirm: `if (await confirm({ title: 'Delete?', tone: 'danger' })) …` */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.getState().request?.resolve(false);
    useConfirmStore.setState({ request: { ...options, resolve } });
  });
}

/** Hook form of `confirm` (same function). */
export const useConfirm = () => confirm;

/** Mounted once in App. */
export function ConfirmHost() {
  const req = useConfirmStore((s) => s.request);
  const close = (ok: boolean) => {
    req?.resolve(ok);
    useConfirmStore.setState({ request: null });
  };
  return (
    <ConfirmDialog
      open={!!req}
      onClose={() => close(false)}
      onConfirm={() => close(true)}
      title={req?.title ?? ''}
      message={req?.message}
      confirmLabel={req?.confirmLabel}
      cancelLabel={req?.cancelLabel}
      tone={req?.tone}
    />
  );
}
