// Demo URL hooks (enabled in dev, or in a build with VITE_DEMO_HOOKS=true):
//   ?as=super_admin|programme_admin|leadership|hr_admin  → signs in as that role's demo admin
//   ?reset=1                                              → resets demo data (and password overrides) first
//   ?idle=demo | ?idle=off                                → idle warning after 10 s (sign-out after 70 s) / normal timers
// The hook parameters are removed from the address bar afterwards; other params (e.g. ?tab=) stay.

import type { AdminRole } from '@shared/types';
import { IDLE_DEMO_KEY } from '@/components/layout/IdleGuard';
import { clearPasswordOverrides, signInAsRole, useAuthStore } from '@/store/auth';
import * as dbApi from '@/store/db';
import { resetDemoData } from '@/store/db';
import { useUiStore } from '@/store/ui';

/** Dev-only console handle: `__mph.getDb()`, `__mph.patch('sessions', id, {...})`, `__mph.auth.getState()` … */
export function exposeDebugHandle() {
  if (!import.meta.env.DEV) return;
  (window as unknown as { __mph: unknown }).__mph = { ...dbApi, auth: useAuthStore, ui: useUiStore };
}

const ROLES: AdminRole[] = ['super_admin', 'programme_admin', 'leadership', 'hr_admin'];

export const demoHooksEnabled = () => import.meta.env.DEV || import.meta.env.VITE_DEMO_HOOKS === 'true';

export async function applyDemoHooks(): Promise<void> {
  if (!demoHooksEnabled()) return;
  const url = new URL(window.location.href);
  const p = url.searchParams;
  let touched = false;

  if (p.get('reset') === '1') {
    await resetDemoData();
    clearPasswordOverrides();
    p.delete('reset');
    touched = true;
  }
  const idle = p.get('idle');
  if (idle) {
    try {
      if (idle === 'demo') sessionStorage.setItem(IDLE_DEMO_KEY, '1');
      else sessionStorage.removeItem(IDLE_DEMO_KEY);
    } catch {
      /* ignore */
    }
    p.delete('idle');
    touched = true;
  }
  const as = p.get('as') as AdminRole | null;
  if (as && ROLES.includes(as)) {
    signInAsRole(as);
    p.delete('as');
    touched = true;
  }
  if (touched) window.history.replaceState(window.history.state, '', url.pathname + (p.toString() ? `?${p}` : '') + url.hash);
}
