import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, CircleAlert, CircleCheckBig, Eye, EyeOff, Info, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { isEmail, isStrongPassword, passwordRules } from '@/lib/password';
import { RESET_CODE, adminExists, passwordFor, resetPassword } from '@/store/auth';
import { Button, Input, toast } from '@/components/ui';
import { AuthBanner, AuthLayout } from './AuthLayout';

type Step = 'email' | 'code' | 'password' | 'done';
const STEPS: { id: Step; label: string }[] = [
  { id: 'email', label: 'Email' },
  { id: 'code', label: 'Verify' },
  { id: 'password', label: 'New password' },
];

function Stepper({ step }: { step: Step }) {
  const idx = step === 'done' ? 3 : STEPS.findIndex((s) => s.id === step);
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => (
        <li key={s.id} className="flex flex-1 items-center gap-2 last:flex-none">
          <span
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors',
              i < idx ? 'bg-primary text-white' : i === idx ? 'bg-primary text-white ring-4 ring-primary-soft' : 'border border-line-strong bg-white text-ink-2',
            )}
          >
            {i < idx ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
          </span>
          <span className={cn('text-[13px] font-medium whitespace-nowrap', i <= idx ? 'text-ink' : 'text-ink-2')}>{s.label}</span>
          {i < STEPS.length - 1 && <span className={cn('h-px min-w-4 flex-1', i < idx ? 'bg-primary' : 'bg-line-strong')} />}
        </li>
      ))}
    </ol>
  );
}

function CodeInput({ value, onChange, invalid }: { value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');
  const set = (i: number, d: string) => {
    const arr = digits.slice();
    arr[i] = d;
    onChange(arr.join('').slice(0, 6));
  };
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
  };
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    onChange(text);
    refs.current[Math.min(text.length, 5)]?.focus();
  };
  return (
    <div className="flex justify-between gap-2" role="group" aria-label="6-digit verification code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          autoFocus={i === 0}
          onPaste={onPaste}
          onKeyDown={(e) => onKey(i, e)}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(-1);
            set(i, v);
            if (v && i < 5) refs.current[i + 1]?.focus();
          }}
          className={cn(
            'h-14 w-full min-w-0 rounded-xl border bg-white text-center text-xl font-bold text-ink tabular transition-[border-color,box-shadow] focus:outline-none',
            invalid ? 'border-danger focus:shadow-[0_0_0_3px_rgba(220,38,38,.15)]' : 'border-line-strong focus:border-primary focus:shadow-[var(--shadow-focus)]',
          )}
        />
      ))}
    </div>
  );
}

export default function ForgotPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const wait = (fn: () => void, ms = 650) => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      fn();
    }, ms);
  };

  const sendCode = (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!isEmail(email)) return setError('Enter a valid email address');
    if (!adminExists(email)) return setError('We couldn’t find an active admin account with that email.');
    wait(() => {
      setStep('code');
      setCode('');
      setCooldown(30);
      toast.info('Verification code sent', `Check ${email.trim()} — demo code ${RESET_CODE}`);
    });
  };

  const verify = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (code.length < 6) return setError('Enter the 6-digit code');
    wait(() => {
      if (code !== RESET_CODE) return setError('That code is incorrect. Please check and try again.');
      setStep('password');
    }, 500);
  };

  const rules = passwordRules(pw);
  const matches = pw.length > 0 && pw === pw2;
  const save = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isStrongPassword(pw)) return setError('Your new password doesn’t meet all the requirements.');
    if (!matches) return setError('The passwords don’t match.');
    if (pw === passwordFor(email)) return setError('Choose a password different from your current one.');
    wait(() => {
      resetPassword(email, pw);
      setStep('done');
    });
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-[440px]">
        <Link to={`/login${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-primary">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>

        {step !== 'done' && (
          <>
            <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
              {step === 'email' ? <KeyRound className="size-6" /> : step === 'code' ? <ShieldCheck className="size-6" /> : <Lock className="size-6" />}
            </span>
            <h2 className="text-[28px] leading-tight font-bold tracking-tight text-ink">
              {step === 'email' ? 'Forgot your password?' : step === 'code' ? 'Check your email' : 'Set a new password'}
            </h2>
            <p className="mt-1.5 text-sm text-ink-2">
              {step === 'email' && 'Enter your admin email and we’ll send you a 6-digit verification code.'}
              {step === 'code' && (
                <>
                  We sent a code to <strong className="font-semibold text-ink">{email.trim()}</strong>. It expires in 10 minutes.
                </>
              )}
              {step === 'password' && 'Choose a strong password you haven’t used before.'}
            </p>
            <div className="mt-6">
              <Stepper step={step} />
            </div>
          </>
        )}

        {error && (
          <div className="mt-5">
            <AuthBanner tone="danger" icon={CircleAlert}>
              {error}
            </AuthBanner>
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={sendCode} noValidate className="mt-6 flex flex-col gap-4">
            <Input label="Work email" type="email" icon={Mail} size="lg" placeholder="name@pcbl.demo" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            <Button type="submit" size="lg" fullWidth loading={loading}>
              Send verification code
            </Button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={verify} noValidate className="mt-6 flex flex-col gap-4">
            <CodeInput value={code} onChange={setCode} invalid={!!error} />
            <AuthBanner tone="info" icon={Info}>
              Demo environment — use code <strong className="font-bold tabular">{RESET_CODE}</strong>.
            </AuthBanner>
            <Button type="submit" size="lg" fullWidth loading={loading} disabled={code.length < 6}>
              Verify code
            </Button>
            <p className="text-center text-[13px] text-ink-2">
              Didn’t get it?{' '}
              {cooldown > 0 ? (
                <span className="tabular">Resend in {cooldown}s</span>
              ) : (
                <button type="button" onClick={() => sendCode()} className="font-semibold text-primary hover:underline">
                  Resend code
                </button>
              )}
              {' · '}
              <button type="button" onClick={() => (setStep('email'), setError(null))} className="font-semibold text-primary hover:underline">
                Change email
              </button>
            </p>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={save} noValidate className="mt-6 flex flex-col gap-4">
            <Input
              label="New password"
              type={show ? 'text' : 'password'}
              icon={Lock}
              size="lg"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoFocus
              rightElement={
                <button type="button" onClick={() => setShow((s) => !s)} className="grid size-9 place-items-center rounded-md text-muted hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                </button>
              }
            />
            <ul className="grid grid-cols-1 gap-1.5 rounded-xl border border-line bg-canvas px-4 py-3 sm:grid-cols-2" aria-label="Password requirements">
              {rules.map((r) => (
                <li key={r.id} className={cn('flex items-center gap-2 text-[13px] transition-colors', r.ok ? 'text-success' : 'text-ink-2')}>
                  <span className={cn('grid size-4 place-items-center rounded-full', r.ok ? 'bg-success text-white' : 'border border-line-strong bg-white')}>
                    {r.ok && <Check className="size-2.5" strokeWidth={3.5} />}
                  </span>
                  {r.label}
                </li>
              ))}
            </ul>
            <Input
              label="Confirm new password"
              type={show ? 'text' : 'password'}
              icon={Lock}
              size="lg"
              autoComplete="new-password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              error={pw2 && !matches ? 'Passwords don’t match' : undefined}
              hint={matches ? 'Passwords match' : undefined}
            />
            <Button type="submit" size="lg" fullWidth loading={loading} disabled={!isStrongPassword(pw) || !matches}>
              Update password
            </Button>
          </form>
        )}

        {step === 'done' && (
          <div className="text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-success-soft text-success">
              <CircleCheckBig className="size-8" />
            </span>
            <h2 className="mt-5 text-[28px] leading-tight font-bold tracking-tight text-ink">Password updated</h2>
            <p className="mt-2 text-sm text-ink-2">
              Your password for <strong className="font-semibold text-ink">{email.trim()}</strong> has been changed. Use it the next time you sign in.
            </p>
            <Button size="lg" fullWidth className="mt-7" onClick={() => navigate(`/login?updated=1&email=${encodeURIComponent(email.trim())}`)}>
              Back to sign in
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
