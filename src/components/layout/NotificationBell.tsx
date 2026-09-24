import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarX, CircleCheck, CircleX, ClipboardList, FileText, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { adminEvents, type AdminEventKind } from '@/lib/events';
import { timeAgo } from '@/lib/format';
import { usePermissions } from '@/lib/rbac';
import { useScope } from '@/lib/scope';
import { useDb } from '@/store/db';
import { useUiStore } from '@/store/ui';
import { EmptyState, Popover } from '@/components/ui';

const KIND: Record<AdminEventKind, { icon: LucideIcon; cls: string }> = {
  application: { icon: FileText, cls: 'bg-mentor-soft text-mentor' },
  match_accepted: { icon: CircleCheck, cls: 'bg-success-soft text-success' },
  match_declined: { icon: CircleX, cls: 'bg-danger-soft text-danger' },
  session_missed: { icon: CalendarX, cls: 'bg-danger-soft text-danger' },
  calendar_failed: { icon: TriangleAlert, cls: 'bg-warning-soft text-warning' },
  survey: { icon: ClipboardList, cls: 'bg-primary-soft text-primary' },
};

/** Top-bar bell: recent admin-relevant events derived from the data, filtered by permission and unit scope. */
export function NotificationBell() {
  const db = useDb();
  const permissions = usePermissions();
  const { unitId } = useScope();
  const seenAt = useUiStore((s) => s.notificationsSeenAt);
  const markSeen = useUiStore((s) => s.markNotificationsSeen);
  const events = useMemo(() => adminEvents(db, { permissions, unitId }), [db, permissions, unitId]);
  const unread = events.filter((e) => !seenAt || e.at > seenAt).length;

  return (
    <Popover
      width="w-[min(400px,calc(100vw-2rem))]"
      trigger={(p) => (
        <button {...p} type="button" className="relative grid size-10 place-items-center rounded-full text-ink-2 transition-colors hover:bg-neutral-soft hover:text-ink" aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}>
          <Bell className="size-5" strokeWidth={1.9} />
          {unread > 0 && (
            <span className="absolute top-0.5 right-0 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-danger px-1 text-[10px] leading-none font-bold text-white ring-2 ring-white tabular">{unread > 9 ? '9+' : unread}</span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">Notifications</p>
              <p className="text-xs text-ink-2">Last 14 days{unitId ? ' · your unit' : ''}</p>
            </div>
            {unread > 0 && (
              <button type="button" onClick={markSeen} className="text-xs font-semibold text-primary hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          {events.length === 0 ? (
            <EmptyState size="sm" icon={Bell} title="You’re all caught up" message="New applications, missed sessions and survey activity will show up here." />
          ) : (
            <ul className="scrollbar-thin max-h-[420px] divide-y divide-line overflow-y-auto">
              {events.map((e) => {
                const k = KIND[e.kind];
                const isUnread = !seenAt || e.at > seenAt;
                return (
                  <li key={e.id}>
                    <Link to={e.link} onClick={close} className={cn('flex gap-3 px-4 py-3 transition-colors hover:bg-canvas', isUnread && 'bg-primary-soft/40')}>
                      <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', k.cls)}>
                        <k.icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-semibold text-ink">{e.title}</span>
                          {isUnread && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-ink-2">{e.body}</span>
                        <span className="mt-1 block text-[11px] text-muted">{timeAgo(e.at)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Popover>
  );
}
