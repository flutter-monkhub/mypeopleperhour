// Admin authentication (demo, no backend).
//
// • Accounts = `db.adminUsers` (active ones). Password `Admin@123` unless the user reset it via
//   Forgot password / changed it in Settings (per-email override kept here, persisted).
// • Session token expires 8h after sign-in. Idle warning after 14 min, auto sign-out at 15 min
//   (see components/layout/IdleGuard.tsx). The sign-out reason is shown on the login page.
// • "Active sessions" = this browser + a couple of simulated devices (Settings → Sessions & security).

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AdminRole, AdminUser } from '@shared/types';
import { getDb, patch, useDbStore } from './db';

export const DEFAULT_ADMIN_PASSWORD = 'Admin@123';
export const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
export const IDLE_WARNING_MS = 14 * 60 * 1000;
export const IDLE_SIGNOUT_MS = 15 * 60 * 1000;
/** Demo code for Forgot password */
export const RESET_CODE = '123456';

export type SignOutReason = 'manual' | 'idle' | 'expired' | 'revoked' | 'deactivated';

export interface AuthSession {
  token: string;
  adminId: string;
  issuedAt: string;
  expiresAt: string;
}

export interface DeviceSession {
  id: string;
  label: string; // "Chrome on macOS"
  kind: 'desktop' | 'mobile' | 'tablet';
  location: string;
  ip: string;
  lastActiveAt: string;
  signedInAt: string;
}

interface AuthState {
  session: AuthSession | null;
  /** email (lower-case) → password set through reset/change */
  passwords: Record<string, string>;
  /** Simulated *other* sessions for the signed-in admin */
  otherDevices: DeviceSession[];
  /** Why the last session ended (login page banner); cleared on next sign-in */
  signOutReason: SignOutReason | null;
  /** ms epoch of the last user activity (memory only) */
  lastActiveAt: number;
}

const randomToken = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return 'mph_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

export const useAuthStore = create<AuthState>()(
  persist(
    (): AuthState => ({
      session: null,
      passwords: {},
      otherDevices: [],
      signOutReason: null,
      lastActiveAt: Date.now(),
    }),
    {
      name: 'mph-admin-auth-v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ session: s.session, passwords: s.passwords, otherDevices: s.otherDevices, signOutReason: s.signOutReason }),
    },
  ),
);

// ───────────────────────── helpers ─────────────────────────

const findAdmin = (email: string) => {
  const e = email.trim().toLowerCase();
  return getDb().adminUsers.find((u) => u.email.toLowerCase() === e);
};

export const passwordFor = (email: string) => useAuthStore.getState().passwords[email.trim().toLowerCase()] ?? DEFAULT_ADMIN_PASSWORD;

/** Browser + OS of this device, e.g. "Chrome on macOS" */
export function currentDeviceLabel(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  return `${browser} on ${os}`;
}

function fakeDevices(user: AdminUser, now: number): DeviceSession[] {
  const city = user.unitScope === 'U-DGP' ? 'Durgapur, IN' : 'Kolkata, IN';
  return [
    { id: 'DEV-IPHONE', label: 'Safari on iPhone', kind: 'mobile', location: city, ip: '103.21.58.14', lastActiveAt: new Date(now - 2 * 3600e3).toISOString(), signedInAt: new Date(now - 3 * 86400e3).toISOString() },
    { id: 'DEV-WIN', label: 'Edge on Windows 11', kind: 'desktop', location: 'Mumbai, IN', ip: '49.36.112.201', lastActiveAt: new Date(now - 26 * 3600e3).toISOString(), signedInAt: new Date(now - 6 * 86400e3).toISOString() },
  ];
}

function startSession(user: AdminUser) {
  const now = Date.now();
  const state = useAuthStore.getState();
  useAuthStore.setState({
    session: { token: randomToken(), adminId: user.id, issuedAt: new Date(now).toISOString(), expiresAt: new Date(now + TOKEN_TTL_MS).toISOString() },
    otherDevices: state.session?.adminId === user.id || state.otherDevices.length ? state.otherDevices : fakeDevices(user, now),
    signOutReason: null,
    lastActiveAt: now,
  });
  patch('adminUsers', user.id, { lastLoginAt: new Date(now).toISOString() });
}

// ───────────────────────── actions ─────────────────────────

export type SignInResult = { ok: true; user: AdminUser } | { ok: false; error: string };

export function signIn(email: string, password: string): SignInResult {
  const user = findAdmin(email);
  if (!user || password !== passwordFor(email)) return { ok: false, error: 'Incorrect email or password. Please try again.' };
  if (!user.active) return { ok: false, error: 'This admin account is deactivated. Contact your super admin.' };
  startSession(user);
  return { ok: true, user };
}

/** Demo hook: sign in as the first active admin with this role (used by `?as=`). */
export function signInAsRole(role: AdminRole): AdminUser | null {
  const user = getDb().adminUsers.find((u) => u.role === role && u.active);
  if (!user) return null;
  startSession(user);
  return user;
}

let manualSignOutAt = 0;

export function signOut(reason: SignOutReason = 'manual') {
  if (reason === 'manual') manualSignOutAt = Date.now();
  useAuthStore.setState({ session: null, signOutReason: reason, otherDevices: [] });
}

/** True right after a deliberate sign-out (guards send you to a clean /login without `next`). */
export const justSignedOut = () => Date.now() - manualSignOutAt < 3000;

/** Record user activity (resets the idle timer). */
export function touch() {
  useAuthStore.setState({ lastActiveAt: Date.now() });
}

export function isSessionValid(s: AuthSession | null, now = Date.now()): s is AuthSession {
  return !!s && new Date(s.expiresAt).getTime() > now;
}

export function adminExists(email: string): AdminUser | undefined {
  const u = findAdmin(email);
  return u?.active ? u : undefined;
}

/** Forgot password → set a new password for this admin email. */
export function resetPassword(email: string, newPassword: string) {
  useAuthStore.setState((s) => ({ passwords: { ...s.passwords, [email.trim().toLowerCase()]: newPassword } }));
}

export function changePassword(current: string, next: string): { ok: boolean; error?: string } {
  const user = getCurrentAdmin();
  if (!user) return { ok: false, error: 'Not signed in' };
  if (current !== passwordFor(user.email)) return { ok: false, error: 'Current password is incorrect' };
  if (current === next) return { ok: false, error: 'New password must be different from the current one' };
  resetPassword(user.email, next);
  return { ok: true };
}

export function clearPasswordOverrides() {
  useAuthStore.setState({ passwords: {} });
}

export function revokeDevice(id: string) {
  useAuthStore.setState((s) => ({ otherDevices: s.otherDevices.filter((d) => d.id !== id) }));
}

export function signOutOtherSessions() {
  useAuthStore.setState({ otherDevices: [] });
}

// ───────────────────────── current admin ─────────────────────────

/** The signed-in admin (live from db.adminUsers, so role/scope edits apply immediately). */
export function getCurrentAdmin(): AdminUser | null {
  const s = useAuthStore.getState().session;
  if (!isSessionValid(s)) return null;
  return getDb().adminUsers.find((u) => u.id === s.adminId) ?? null;
}

export function useSession(): AuthSession | null {
  return useAuthStore((s) => s.session);
}

export function useCurrentAdmin(): AdminUser | null {
  const adminId = useAuthStore((s) => s.session?.adminId);
  return useDbStore((s) => (adminId ? (s.db.adminUsers.find((u) => u.id === adminId) ?? null) : null));
}

/** Employee id to stamp on records created by the signed-in admin (`by`, `createdBy`, `proposedBy`). */
export const currentActorId = () => getCurrentAdmin()?.employeeId ?? 'system';
