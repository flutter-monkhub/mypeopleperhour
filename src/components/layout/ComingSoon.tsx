import type { ReactNode } from 'react';
import { Hammer, type LucideIcon } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui';
import { PageHeader } from './PageHeader';

/** Placeholder used by pages that a feature agent has not built yet. */
export function ComingSoon({ title, subtitle, icon = Hammer, note }: { title: string; subtitle?: ReactNode; icon?: LucideIcon; note?: ReactNode }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Card padding="none">
        <EmptyState size="lg" icon={icon} title="Coming soon" message={note ?? 'This page is being built. The navigation, permissions and data are already wired up.'} />
      </Card>
    </>
  );
}
