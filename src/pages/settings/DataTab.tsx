import { useMemo, useState } from 'react';
import {
  Building2,
  CalendarCheck,
  ClipboardList,
  Database,
  FileText,
  GraduationCap,
  Handshake,
  HardDrive,
  MessageSquare,
  NotebookPen,
  RotateCcw,
  ShieldCheck,
  Smile,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { formatBytes, formatDateTime, formatNumber } from '@/lib/format';
import { clearPasswordOverrides } from '@/store/auth';
import { persistedBytes, resetDemoData, useDb, useDbMeta, type CollectionKey } from '@/store/db';
import { Button, Card, CardHeader, ConfirmDialog, DescriptionList, toast } from '@/components/ui';

const COUNTS: { key: CollectionKey; label: string; icon: LucideIcon }[] = [
  { key: 'employees', label: 'Employees', icon: Users },
  { key: 'units', label: 'Units', icon: Building2 },
  { key: 'sessions', label: 'MPH sessions', icon: CalendarCheck },
  { key: 'notes', label: 'Manager notes', icon: NotebookPen },
  { key: 'surveys', label: 'Surveys', icon: ClipboardList },
  { key: 'responses', label: 'Survey responses', icon: MessageSquare },
  { key: 'moodChecks', label: 'Mood checks', icon: Smile },
  { key: 'mentors', label: 'Mentor profiles', icon: GraduationCap },
  { key: 'applications', label: 'Applications', icon: FileText },
  { key: 'matches', label: 'Mentor matches', icon: Handshake },
  { key: 'mentoringSessions', label: 'Conversations', icon: CalendarCheck },
  { key: 'adminUsers', label: 'Admin users', icon: ShieldCheck },
];

export function DataTab() {
  const db = useDb();
  const meta = useDbMeta();
  const [open, setOpen] = useState(false);
  // recompute size whenever the db changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bytes = useMemo(() => persistedBytes(), [db]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.4fr]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Demo data" subtitle="Everything is stored locally in this browser — there is no backend." icon={Database} />
          <DescriptionList
            columns={1}
            items={[
              { label: 'Seed generated', value: meta ? formatDateTime(meta.seedGeneratedAt) : '—' },
              { label: 'Loaded in this browser', value: meta ? formatDateTime(meta.loadedAt) : '—' },
              { label: 'Dates rebased by', value: meta ? `${meta.rebasedDays} days (so the demo reads naturally today)` : '—' },
              { label: 'Local storage used', value: `${formatBytes(bytes)} of ~5 MB browser quota` },
            ]}
          />
        </Card>
        <Card className="border-danger/25">
          <CardHeader title="Reset demo data" subtitle="Discard every change made in this browser and reload the original seed (rebased to today). Password changes are cleared too." icon={RotateCcw} iconTone="danger" />
          <Button variant="danger" icon={RotateCcw} onClick={() => setOpen(true)}>
            Reset demo data
          </Button>
        </Card>
      </div>

      <Card>
        <CardHeader title="Records" subtitle="Current counts in the local database." icon={HardDrive} iconTone="neutral" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COUNTS.map((c) => (
            <div key={c.key} className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                <c.icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-lg leading-6 font-bold text-ink tabular">{formatNumber((db[c.key] as unknown[]).length)}</p>
                <p className="truncate text-xs text-ink-2">{c.label}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        tone="danger"
        title="Reset all demo data?"
        message="All sessions, surveys, mentoring changes and admin users edited in this browser will be replaced with the original demo data. This can’t be undone."
        confirmLabel="Reset data"
        onConfirm={async () => {
          await resetDemoData();
          clearPasswordOverrides();
          toast.success('Demo data reset', 'The original seed has been reloaded.');
        }}
      />
    </div>
  );
}
