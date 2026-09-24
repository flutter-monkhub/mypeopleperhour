import { UsersRound } from 'lucide-react';
import { cn } from '@/lib/cn';

/** MyPeopleHour app mark (blue tile with people icon, like the reference snapshots). */
export function AppMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-xl text-white shadow-[0_6px_16px_rgba(47,86,232,.35)]', className)}
      style={{ width: size, height: size, backgroundImage: 'linear-gradient(145deg, #4C74FF 0%, #2F56E8 55%, #2442C9 100%)' }}
      aria-hidden
    >
      <UsersRound style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2.2} />
    </span>
  );
}

/** Logo lockup for dark (sidebar) or light backgrounds. */
export function BrandLockup({ tone = 'dark', subtitle = 'PCBL Admin' }: { tone?: 'dark' | 'light'; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <AppMark />
      <div className="leading-tight">
        <p className={cn('text-[19px] font-bold tracking-tight', tone === 'dark' ? 'text-white' : 'text-ink')}>MyPeopleHour</p>
        <p className={cn('text-xs font-medium', tone === 'dark' ? 'text-[#9FB2EA]' : 'text-ink-2')}>{subtitle}</p>
      </div>
    </div>
  );
}

/** Simple vector of two people in conversation with a clock — the programme motif. */
export function ConversationIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 130" className={className} role="img" aria-label="Two people in a one-to-one conversation">
      <ellipse cx="110" cy="121" rx="96" ry="6" fill="#E6EBFA" />
      {/* clock */}
      <circle cx="110" cy="30" r="17" fill="#fff" stroke="#6D5BD0" strokeWidth="3" />
      <path d="M110 20v10l7 5" stroke="#6D5BD0" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* left chair + person */}
      <rect x="22" y="72" width="16" height="44" rx="6" fill="#C9D6FB" />
      <rect x="26" y="96" width="46" height="12" rx="6" fill="#C9D6FB" />
      <path d="M40 104c0-22 6-40 22-40s20 14 20 30v10z" fill="#4F46E5" />
      <path d="M58 104h30c6 0 8 4 8 8v6h-10v-6H58z" fill="#312E81" />
      <circle cx="62" cy="50" r="11" fill="#F4C7A1" />
      <path d="M51 49c0-9 6-14 12-14s11 5 11 11c-4-3-9-4-14-3-3 1-6 3-9 6z" fill="#2B1B17" />
      <path d="M52 50c-3 8-2 16 2 22 2-6 2-13-2-22z" fill="#2B1B17" />
      <path d="M78 82l16 4" stroke="#F4C7A1" strokeWidth="6" strokeLinecap="round" />
      {/* right chair + person */}
      <rect x="182" y="72" width="16" height="44" rx="6" fill="#C9D6FB" />
      <rect x="148" y="96" width="46" height="12" rx="6" fill="#C9D6FB" />
      <path d="M180 104c0-22-6-40-22-40s-20 14-20 30v10z" fill="#93B4F5" />
      <path d="M162 104h-30c-6 0-8 4-8 8v6h10v-6h28z" fill="#1E3A8A" />
      <circle cx="158" cy="50" r="11" fill="#E0A77F" />
      <path d="M147 47c1-8 7-12 12-12 6 0 11 4 11 10-6-1-14-2-23 2z" fill="#1F2937" />
      <path d="M142 82l-16 4" stroke="#E0A77F" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}
