import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';
import { MPH_TAGLINE } from '@shared/content/mph';
import { cn } from '@/lib/cn';
import { usePermissions } from '@/lib/rbac';
import { useCollection } from '@/store/db';
import { useUiStore } from '@/store/ui';
import { BrandLockup, ConversationIllustration } from './Brand';
import { NAV, activeNavPath } from './nav';

function useBadges() {
  const applications = useCollection('applications');
  return useMemo(
    () => ({ pendingApplications: applications.filter((a) => a.status === 'submitted' || a.status === 'under_review').length }),
    [applications],
  );
}

/** Rendered height of the programme card incl. its top margin */
const CARD_HEIGHT = 250;

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const perms = usePermissions();
  const badges = useBadges();
  const active = activeNavPath(pathname);
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || perms.includes(i.perm)) })).filter((g) => g.items.length);

  // Show the programme card only when it fits under the nav items (no scrolling just for decoration)
  const navRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [showCard, setShowCard] = useState(false);
  useLayoutEffect(() => {
    const nav = navRef.current;
    const list = listRef.current;
    if (!nav || !list) return;
    const measure = () => setShowCard(list.offsetHeight + CARD_HEIGHT <= nav.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    ro.observe(list);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link to="/dashboard" onClick={onNavigate} aria-label="MyPeopleHour Admin home">
          <BrandLockup />
        </Link>
      </div>

      <nav ref={navRef} className="scrollbar-dark flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-2 pb-3" aria-label="Main">
        <div ref={listRef}>
        {groups.map((g, gi) => (
          <div key={g.label ?? `g${gi}`} className={cn(gi > 0 && 'mt-3', !g.label && 'border-t border-white/8 pt-3')}>
            {g.label && <p className="mb-1 px-3 text-[11px] leading-[18px] font-semibold tracking-[0.08em] text-[#7E90C4] uppercase">{g.label}</p>}
            <ul className="flex flex-col gap-px">
              {g.items.map((item) => {
                const isActive = active === item.to;
                const count = item.badge ? badges[item.badge] : 0;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'group flex h-9 items-center gap-3 rounded-lg px-3 text-[14px] font-medium transition-colors duration-150',
                        isActive ? 'bg-primary text-white shadow-[0_6px_16px_rgba(47,86,232,.35)]' : 'text-[#C6D0EE] hover:bg-white/[0.07] hover:text-white',
                      )}
                    >
                      <item.icon className={cn('size-[18px] shrink-0', isActive ? 'text-white' : 'text-[#94A6DA] group-hover:text-white')} strokeWidth={1.9} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {count > 0 && (
                        <span className={cn('rounded-full px-1.5 py-px text-[11px] font-semibold tabular', isActive ? 'bg-white/20 text-white' : 'bg-[#7E3794] text-white')}>{count}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        </div>
        <div className={cn('mt-auto px-1 pt-5', !showCard && 'hidden')} aria-hidden={!showCard}>
          <div className="rounded-xl bg-white p-4 text-ink shadow-[0_10px_30px_rgba(0,0,0,.25)]">
            <ConversationIllustration className="mx-auto h-20 w-auto" />
            <p className="mt-2 text-[13px] leading-snug font-medium whitespace-pre-line text-ink-2">{MPH_TAGLINE.split('. ').join('.\n')}</p>
            <p className="mt-0.5 text-[13px] font-semibold text-ink">Just the person.</p>
            <Link to="/dashboard" onClick={onNavigate} className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
              Programme health <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      <div className="shrink-0 border-t border-white/8 px-5 py-2.5 text-[11px] text-[#7E90C4]">PCBL Chemical · RP-Sanjiv Goenka Group</div>
    </div>
  );
}

/** Fixed navy sidebar on ≥ lg; off-canvas drawer below that (toggled from the Topbar). */
export function Sidebar() {
  const open = useUiStore((s) => s.sidebarOpen);
  const setOpen = useUiStore((s) => s.setSidebarOpen);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname, setOpen]);

  return (
    <>
      <aside className="bg-sidebar fixed inset-y-0 left-0 z-40 hidden w-66 lg:block">
        <SidebarContent />
      </aside>
      {open && (
        <div className="fixed inset-0 z-[75] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 animate-fade-in bg-[rgba(15,23,42,.5)]" onClick={() => setOpen(false)} />
          <aside className="bg-sidebar absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-slide-in-left shadow-pop">
            <button type="button" onClick={() => setOpen(false)} className="absolute top-5 right-3 z-10 grid size-8 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close navigation">
              <X className="size-4.5" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
