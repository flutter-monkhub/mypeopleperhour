// Small UI store: global top-bar filters + chrome state. Persisted (localStorage `mph-admin-ui-v1`).
// Read the effective values through `useScope()` / `useMonth()` in lib/scope.ts — they apply
// hr_admin unit locking and clamp the month to the programme range.

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ID, MonthKey } from '@shared/types';

interface UiState {
  /** Global unit filter chosen in the top bar (null = all units). Ignored for unit-scoped hr_admins. */
  unitId: ID | null;
  /** Global month (null = current month). */
  month: MonthKey | null;
  /** Mobile/tablet off-canvas sidebar */
  sidebarOpen: boolean;
  /** Notification bell: events newer than this are unread */
  notificationsSeenAt: string | null;
  setUnitId: (unitId: ID | null) => void;
  setMonth: (month: MonthKey | null) => void;
  setSidebarOpen: (open: boolean) => void;
  markNotificationsSeen: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      unitId: null,
      month: null,
      sidebarOpen: false,
      notificationsSeenAt: null,
      setUnitId: (unitId) => set({ unitId }),
      setMonth: (month) => set({ month }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      markNotificationsSeen: () => set({ notificationsSeenAt: new Date().toISOString() }),
    }),
    {
      name: 'mph-admin-ui-v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ unitId: s.unitId, month: s.month, notificationsSeenAt: s.notificationsSeenAt }),
    },
  ),
);
