import { useState, type FormEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button, Input, Modal } from '@/components/ui';

export interface TextPromptModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  label: string;
  initial?: string;
  placeholder?: string;
  submitLabel: string;
  icon?: LucideIcon;
  /** Second optional field (e.g. first department of a new function) */
  extra?: { label: string; placeholder?: string; hint?: string };
  /** Return an error message to keep the modal open, or null on success */
  onSubmit: (value: string, extra: string) => string | null;
}

/** Small one-field form in a modal (add / rename). Mount with a changing `key` to reset. */
export function TextPromptModal({ open, onClose, title, description, label, initial = '', placeholder, submitLabel, icon, extra, onSubmit }: TextPromptModalProps) {
  const [value, setValue] = useState(initial);
  const [second, setSecond] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const err = onSubmit(value, second);
    if (err) setError(err);
    else onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={icon}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => submit()} disabled={!value.trim() || value.trim() === initial.trim()}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Input
          label={label}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          error={error ?? undefined}
          maxLength={60}
          data-autofocus
          required
        />
        {extra && <Input label={extra.label} value={second} placeholder={extra.placeholder} hint={extra.hint} onChange={(e) => setSecond(e.target.value)} maxLength={60} />}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
