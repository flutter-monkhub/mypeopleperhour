import { useEffect, useState } from 'react';
import { Clock, KeyRound, Laptop, LogOut, MonitorSmartphone, ShieldCheck, Smartphone, Timer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDateTime, timeAgo } from '@/lib/format';
import {
  IDLE_SIGNOUT_MS,
  IDLE_WARNING_MS,
  TOKEN_TTL_MS,
  currentDeviceLabel,
  revokeDevice,
  signOut,
  signOutOtherSessions,
  useAuthStore,
  useSession,
  type DeviceSession,
} from '@/store/auth';
import { Badge, Button, Card, CardHeader, DescriptionList, confirm, toast } from '@/components/ui';

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const fmtLeft = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

function DeviceRow({ d, current, onRevoke }: { d: Pick<DeviceSession, 'label' | 'kind' | 'location' | 'ip' | 'lastActiveAt'>; current?: boolean; onRevoke?: () => void }) {
  const Icon = d.kind === 'mobile' ? Smartphone : Laptop;
  return (
    <li className="flex items-center gap-4 px-5 py-4">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${current ? 'bg-primary-soft text-primary' : 'bg-neutral-soft text-ink-2'}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          {d.label}
          {current && (
            <Badge tone="success" size="sm" dot>
              This device
            </Badge>
          )}
        </p>
        <p className="text-xs text-ink-2">
          {d.location} · {d.ip} · {current ? 'Active now' : `Last active ${timeAgo(d.lastActiveAt)}`}
        </p>
      </div>
      {onRevoke && (
        <Button variant="ghost" size="sm" onClick={onRevoke}>
          Sign out
        </Button>
      )}
    </li>
  );
}

export function SecurityTab() {
  const session = useSession();
  const others = useAuthStore((s) => s.otherDevices);
  const now = useNow();
  const navigate = useNavigate();
  if (!session) return null;
  const left = new Date(session.expiresAt).getTime() - now;
  const masked = `${session.token.slice(0, 8)}••••••••${session.token.slice(-4)}`;

  const signOutOthers = async () => {
    if (!(await confirm({ title: 'Sign out all other sessions?', message: `${others.length} other ${others.length === 1 ? 'session' : 'sessions'} will be signed out immediately.`, confirmLabel: 'Sign out others', tone: 'danger' }))) return;
    signOutOtherSessions();
    toast.success('Other sessions signed out', 'Only this browser is signed in now.');
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-6">
        <Card padding="none">
          <CardHeader
            divider
            title="Active sessions"
            subtitle="Browsers and devices signed in to your admin account."
            icon={MonitorSmartphone}
            actions={
              others.length > 0 && (
                <Button variant="secondary" size="sm" icon={LogOut} onClick={() => void signOutOthers()}>
                  Sign out other sessions
                </Button>
              )
            }
          />
          <ul className="divide-y divide-line">
            <DeviceRow current d={{ label: currentDeviceLabel(), kind: 'desktop', location: 'Kolkata, IN', ip: '10.12.4.87', lastActiveAt: new Date(now).toISOString() }} />
            {others.map((d) => (
              <DeviceRow
                key={d.id}
                d={d}
                onRevoke={() => {
                  revokeDevice(d.id);
                  toast.success('Session signed out', d.label);
                }}
              />
            ))}
          </ul>
          {others.length === 0 && <p className="border-t border-line px-5 py-3 text-xs text-ink-2">No other active sessions.</p>}
        </Card>

        <Card>
          <CardHeader title="Current session" icon={KeyRound} />
          <DescriptionList
            items={[
              { label: 'Signed in', value: formatDateTime(session.issuedAt) },
              { label: 'Token expires', value: `${formatDateTime(session.expiresAt)} · in ${fmtLeft(left)}` },
              { label: 'Access token', value: <code className="text-[13px]">{masked}</code> },
              { label: 'Device', value: currentDeviceLabel() },
            ]}
          />
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Session policy" icon={ShieldCheck} iconTone="success" />
          <ul className="flex flex-col gap-4">
            {[
              { icon: Timer, title: `Idle timeout · ${IDLE_SIGNOUT_MS / 60000} minutes`, body: `We warn you after ${IDLE_WARNING_MS / 60000} minutes without activity and sign you out a minute later.` },
              { icon: Clock, title: `Session lifetime · ${TOKEN_TTL_MS / 3600000} hours`, body: 'Access tokens expire 8 hours after sign-in, even with activity.' },
              { icon: KeyRound, title: 'Strong passwords', body: '8+ characters with upper & lower case, a number and a symbol.' },
            ].map((p) => (
              <li key={p.title} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-neutral-soft text-ink-2">
                  <p.icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{p.title}</p>
                  <p className="text-[13px] text-ink-2">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Sign out" subtitle="End your session on this browser." />
          <Button
            variant="danger"
            icon={LogOut}
            onClick={() => {
              signOut('manual');
              navigate('/login', { replace: true });
            }}
          >
            Sign out
          </Button>
        </Card>
      </div>
    </div>
  );
}
