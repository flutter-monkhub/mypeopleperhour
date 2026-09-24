import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned buttons */
  actions?: ReactNode;
  /** "← Back" link above the title */
  backTo?: string;
  backLabel?: string;
  /** Small line above the title (e.g. programme name or a status badge row) */
  eyebrow?: ReactNode;
  /** Content under the subtitle (badges, meta) */
  meta?: ReactNode;
  className?: string;
}

/** Page title block (24/700) with subtitle and actions. First element of every page. */
export function PageHeader({ title, subtitle, actions, backTo, backLabel = 'Back', eyebrow, meta, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {backTo && (
          <Link to={backTo} className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-primary">
            <ArrowLeft className="size-4" /> {backLabel}
          </Link>
        )}
        {eyebrow && <div className="mb-1.5 text-xs font-semibold tracking-wide text-primary uppercase">{eyebrow}</div>}
        <h1 className="text-2xl leading-8 font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-ink-2">{subtitle}</p>}
        {meta && <div className="mt-2.5 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
