import type { ReactNode } from 'react';
import { CalendarCheck, HeartHandshake, UsersRound } from 'lucide-react';
import { MPH_DEFINITION, MPH_TAGLINE } from '@shared/content/mph';
import { MENTORING_NAME, MENTORING_PILLARS, MENTORING_TAGLINE } from '@shared/content/mentoring';
import { AppMark } from '@/components/layout';

/** Split auth layout: RPSG-gradient brand panel (left, ≥ lg) + form column (right). */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <aside className="bg-brand-gradient relative hidden w-[46%] max-w-[720px] shrink-0 overflow-hidden text-white lg:flex lg:flex-col">
        {/* soft shapes */}
        <div className="pointer-events-none absolute -top-32 -right-24 size-[420px] rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 size-[480px] rounded-full bg-[#5B1E6E]/35 blur-3xl" />
        <svg className="pointer-events-none absolute inset-0 size-full opacity-[0.08]" aria-hidden>
          <defs>
            <pattern id="auth-dots" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.5" fill="#fff" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-dots)" />
        </svg>

        <div className="relative flex flex-1 flex-col px-12 py-10 xl:px-16">
          <div className="flex w-fit items-center gap-6 rounded-2xl bg-white px-6 py-3.5 shadow-[0_12px_32px_rgba(60,10,60,.25)]">
            <img src="/brand/rpsg-logo.png" alt="RP-Sanjiv Goenka Group" className="h-12 w-auto" />
            <span className="h-11 w-px bg-line" />
            <img src="/brand/pcbl-logo.png" alt="PCBL Chemical" className="h-14 w-auto" />
          </div>

          <div className="mt-auto max-w-xl pt-12">
            <div className="mb-6 flex items-center gap-3">
              <AppMark size={44} />
              <div>
                <p className="text-xl font-bold tracking-tight">MyPeopleHour</p>
                <p className="text-sm text-white/80">& {MENTORING_NAME}</p>
              </div>
            </div>
            <h1 className="text-[40px] leading-[1.1] font-extrabold tracking-tight xl:text-[46px]">{MPH_TAGLINE}</h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/85">{MPH_DEFINITION}</p>

            <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
              {[
                { icon: CalendarCheck, title: '1 hour', body: 'every month, per direct report' },
                { icon: UsersRound, title: '3 levels', body: 'completion · quality · outcome' },
                { icon: HeartHandshake, title: '6 months', body: 'mentoring beyond functions' },
              ].map((s) => (
                <div key={s.title} className="rounded-xl border border-white/20 bg-white/10 p-3.5 backdrop-blur-sm">
                  <s.icon className="size-5 text-white/90" />
                  <p className="mt-2 text-lg font-bold">{s.title}</p>
                  <p className="text-xs leading-snug text-white/80">{s.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <p className="text-sm font-semibold">
                {MENTORING_NAME} · <span className="font-normal text-white/85">{MENTORING_TAGLINE}</span>
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {MENTORING_PILLARS.map((p) => (
                  <span key={p} className="rounded-full border border-white/25 bg-white/15 px-3 py-0.5 text-xs font-semibold">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-10 text-xs text-white/70">© {new Date().getFullYear()} PCBL Chemical Ltd · An RP-Sanjiv Goenka Group company</p>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {/* compact brand header on small screens */}
        <div className="bg-brand-gradient flex items-center justify-between px-5 py-4 lg:hidden">
          <div className="flex items-center gap-2.5 text-white">
            <AppMark size={34} />
            <span className="text-lg font-bold">MyPeopleHour</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-1.5">
            <img src="/brand/rpsg-logo.png" alt="RP-Sanjiv Goenka Group" className="h-6 w-auto" />
            <img src="/brand/pcbl-logo.png" alt="PCBL Chemical" className="h-7 w-auto" />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">{children}</div>
      </main>
    </div>
  );
}

/** Coloured info/warning/error banner used on the auth pages. */
export function AuthBanner({ tone, icon: Icon, children }: { tone: 'info' | 'warning' | 'danger' | 'success'; icon: typeof CalendarCheck; children: ReactNode }) {
  const cls = {
    info: 'bg-info-soft text-primary-dark border-primary/20',
    warning: 'bg-warning-soft text-[#8A4B00] border-warning/25',
    danger: 'bg-danger-soft text-[#991B1B] border-danger/20',
    success: 'bg-success-soft text-[#166534] border-success/25',
  }[tone];
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-[13px] leading-snug ${cls}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon className="mt-px size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
