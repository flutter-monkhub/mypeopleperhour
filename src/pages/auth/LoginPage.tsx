import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { CircleAlert, Clock, Eye, EyeOff, Info, Lock, LogIn, Mail, ShieldOff } from 'lucide-react';
import type { AdminRole } from '@shared/types';
import { cn } from '@/lib/cn';
import { isEmail } from '@/lib/password';
import { ROLE_META, ROLES } from '@/lib/rbac';
import { DEFAULT_ADMIN_PASSWORD, isSessionValid, signIn, useAuthStore, useSession, type SignOutReason } from '@/store/auth';
import { useCollection } from '@/store/db';
import { Avatar, Badge, Button, Input } from '@/components/ui';
import { AuthBanner, AuthLayout } from './AuthLayout';

const REASONS: Partial<Record<SignOutReason, { tone: 'info' | 'warning' | 'danger'; icon: typeof Info; text: string }>> = {
  idle: { tone: 'warning', icon: Clock, text: 'You were signed out after 15 minutes of inactivity. Please sign in again.' },
  expired: { tone: 'warning', icon: Clock, text: 'Your session expired (8 hours). Please sign in again.' },
  deactivated: { tone: 'danger', icon: ShieldOff, text: 'Your admin access has been deactivated. Contact your super admin.' },
  manual: { tone: 'info', icon: Info, text: 'You have been signed out.' },
};

export default function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const session = useSession();
  const storedReason = useAuthStore((s) => s.signOutReason);
  const adminUsers = useCollection('adminUsers');

  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);

  const next = params.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : '/dashboard';
  const reasonKey = (params.get('reason') as SignOutReason | null) ?? storedReason;
  const reason = reasonKey && !formError ? REASONS[reasonKey] : undefined;
  const updated = params.get('updated') === '1';

  if (isSessionValid(session) && !loading) return <Navigate to={safeNext} replace />;

  const demoAccounts = ROLES.map((role) => adminUsers.find((u) => u.role === role && u.active)).filter((u): u is NonNullable<typeof u> => !!u);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!email.trim()) errs.email = 'Enter your work email';
    else if (!isEmail(email)) errs.email = 'Enter a valid email address';
    if (!password) errs.password = 'Enter your password';
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;
    setLoading(true);
    setTimeout(() => {
      const res = signIn(email, password);
      if (!res.ok) {
        setLoading(false);
        setFormError(res.error);
        return;
      }
      navigate(safeNext, { replace: true });
    }, 650);
  };

  const fill = (role: AdminRole) => {
    const u = demoAccounts.find((a) => a.role === role);
    if (!u) return;
    setEmail(u.email);
    setPassword(useAuthStore.getState().passwords[u.email.toLowerCase()] ?? DEFAULT_ADMIN_PASSWORD);
    setErrors({});
    setFormError(null);
    submitRef.current?.focus();
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-[460px]">
        <h2 className="text-[28px] leading-tight font-bold tracking-tight text-ink">Welcome back</h2>
        <p className="mt-1.5 text-sm text-ink-2">Sign in to the MyPeopleHour & Mentoring admin panel.</p>

        <div className="mt-6 flex flex-col gap-3 empty:hidden">
          {updated && (
            <AuthBanner tone="success" icon={Info}>
              Your password was updated. Sign in with your new password.
            </AuthBanner>
          )}
          {!updated && reason && (
            <AuthBanner tone={reason.tone} icon={reason.icon}>
              {reason.text}
            </AuthBanner>
          )}
          {formError && (
            <AuthBanner tone="danger" icon={CircleAlert}>
              {formError}
            </AuthBanner>
          )}
        </div>

        <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
          <Input
            label="Work email"
            type="email"
            autoComplete="username"
            icon={Mail}
            placeholder="name@pcbl.demo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            size="lg"
          />
          <Input
            label="Password"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            icon={Lock}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            size="lg"
            labelAside={
              <Link to={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="font-medium text-primary hover:underline">
                Forgot password?
              </Link>
            }
            rightElement={
              <button type="button" onClick={() => setShow((s) => !s)} className="grid size-9 place-items-center rounded-md text-muted hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
              </button>
            }
          />
          <Button ref={submitRef} type="submit" size="lg" fullWidth loading={loading} icon={LogIn} className="mt-1">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-8">
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-xs font-semibold tracking-wide text-ink-2 uppercase">Demo accounts</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <p className="mt-2 text-center text-xs text-ink-2">
            Click a card to fill the form · password <code className="rounded bg-neutral-soft px-1 py-px font-semibold text-ink">{DEFAULT_ADMIN_PASSWORD}</code>
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {demoAccounts.map((u) => {
              const meta = ROLE_META[u.role];
              const selected = email.trim().toLowerCase() === u.email.toLowerCase();
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => fill(u.role)}
                  aria-pressed={selected}
                  className={cn(
                    'group flex flex-col gap-2 rounded-xl border p-3 text-left transition-[border-color,box-shadow,background-color] duration-150',
                    selected ? 'border-primary bg-primary-soft/60 shadow-[var(--shadow-focus)]' : 'border-line bg-white hover:border-line-strong hover:shadow-card',
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <Avatar name={u.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">{u.name}</span>
                      <span className="block truncate text-[11px] text-ink-2">{u.title}</span>
                    </span>
                  </span>
                  <Badge tone={meta.tone} size="sm" className="w-fit">
                    {meta.label}
                  </Badge>
                  <span className="text-[11px] leading-snug text-ink-2">{meta.access}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
