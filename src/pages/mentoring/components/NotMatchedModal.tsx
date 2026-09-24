// Close an application without a match — a reason is required (kept in the history).

import { useState } from 'react';
import { UserX } from 'lucide-react';
import type { MenteeApplication } from '@shared/types';
import { cn } from '@/lib/cn';
import { markNotMatched } from '@/store/actions';
import { Button, Modal, Textarea, toast } from '@/components/ui';

const REASONS = [
  'Purpose not yet clear enough — encouraged to reapply next cohort',
  'No preferred mentor has capacity this cohort',
  'Preferred mentors conflict with the matching rules',
  'Better served by another development programme',
];

export function NotMatchedModal({ app, applicantName, open, onClose }: { app: MenteeApplication; applicantName: string; open: boolean; onClose: () => void }) {
  const [preset, setPreset] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reason = [preset, detail.trim()].filter(Boolean).join(' — ');

  const close = () => {
    setPreset(null);
    setDetail('');
    setError(null);
    onClose();
  };
  const submit = () => {
    if (!reason) return setError('Choose or write a reason');
    try {
      markNotMatched(app.id, reason);
      toast.success('Marked as not matched', `${applicantName} has been notified. Any open proposal was withdrawn.`);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      icon={UserX}
      iconTone="danger"
      title="Mark as not matched?"
      description={`${applicantName} will be told we couldn’t find the right match this time. The reason stays in the history (not shown to them).`}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} disabled={!reason}>
            Mark not matched
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div role="radiogroup" aria-label="Reason" className="flex flex-col gap-1.5">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={preset === r}
              onClick={() => (setPreset(preset === r ? null : r), setError(null))}
              className={cn(
                'rounded-lg border px-3 py-2 text-left text-[13px] transition-colors',
                preset === r ? 'border-danger/50 bg-danger-soft/60 font-medium text-ink' : 'border-line text-ink-2 hover:border-line-strong hover:bg-canvas',
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <Textarea label="Details (optional)" value={detail} onChange={(e) => (setDetail(e.target.value), setError(null))} rows={2} maxLength={300} error={error ?? undefined} />
      </div>
    </Modal>
  );
}
