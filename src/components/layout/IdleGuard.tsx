import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { IDLE_SIGNOUT_MS, IDLE_WARNING_MS, signOut, touch, useAuthStore, type SignOutReason } from '@/store/auth';
import { Button, Modal } from '@/components/ui';

/** `?idle=demo` (dev hook) shortens the timers: warning after 10 s, sign-out 60 s later. */
export const IDLE_DEMO_KEY = 'mph-idle-demo';
const timings = () => {
  let demo = false;
  try {
    demo = sessionStorage.getItem(IDLE_DEMO_KEY) === '1';
  } catch {
    /* storage unavailable */
  }
  return demo ? { warn: 10_000, out: 70_000 } : { warn: IDLE_WARNING_MS, out: IDLE_SIGNOUT_MS };
};

const ACTIVITY = ['mousedown', 'keydown', 'wheel', 'touchstart', 'mousemove'] as const;

/**
 * Session watchdog (mounted in AppLayout):
 *  • token expiry (8h) → sign out with reason "expired"
 *  • idle 14 min → warning modal with countdown + "Stay signed in"; 15 min → sign out ("idle")
 */
export function IdleGuard() {
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState<number | null>(null);
  const warning = remaining != null;

  // Activity resets the idle clock — but not while the warning is up (the user must confirm).
  useEffect(() => {
    if (warning) return;
    let last = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - last > 3000) {
        last = now;
        touch();
      }
    };
    ACTIVITY.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    return () => ACTIVITY.forEach((ev) => window.removeEventListener(ev, onActivity));
  }, [warning]);

  useEffect(() => {
    const end = (reason: SignOutReason) => {
      signOut(reason);
      navigate(`/login?reason=${reason}`, { replace: true });
    };
    const tick = () => {
      const { session, lastActiveAt } = useAuthStore.getState();
      if (!session) return;
      const now = Date.now();
      if (new Date(session.expiresAt).getTime() <= now) return end('expired');
      const { warn, out } = timings();
      const idle = now - lastActiveAt;
      if (idle >= out) return end('idle');
      setRemaining(idle >= warn ? out - idle : null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [navigate]);

  const secs = Math.max(0, Math.ceil((remaining ?? 0) / 1000));
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

  return (
    <Modal
      open={warning}
      onClose={() => {}}
      dismissible={false}
      hideClose
      size="sm"
      icon={Clock}
      iconTone="warning"
      title="Are you still there?"
      description="For your security, you’ll be signed out after 15 minutes of inactivity."
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              signOut('manual');
              navigate('/login', { replace: true });
            }}
          >
            Sign out now
          </Button>
          <Button
            data-autofocus
            onClick={() => {
              touch();
              setRemaining(null);
            }}
          >
            Stay signed in
          </Button>
        </>
      }
    >
      <div className="rounded-xl bg-warning-soft px-4 py-3 text-center">
        <p className="text-xs font-medium text-[#9A5200]">Signing out in</p>
        <p className="text-3xl font-bold text-[#9A5200] tabular">{mmss}</p>
      </div>
    </Modal>
  );
}
