import { useSearchParams } from 'react-router-dom';
import { Database, KeyRound, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Tabs, type TabItem } from '@/components/ui';
import { useCan } from '@/lib/rbac';
import { useCollection } from '@/store/db';
import { AdminUsersTab } from './AdminUsersTab';
import { DataTab } from './DataTab';
import { ProfileTab } from './ProfileTab';
import { RolesTab } from './RolesTab';
import { SecurityTab } from './SecurityTab';

type TabId = 'profile' | 'users' | 'roles' | 'security' | 'data';

export default function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const canManage = useCan('settings.manage');
  const adminUsers = useCollection('adminUsers');

  const tabs: TabItem<TabId>[] = [
    { id: 'profile', label: 'My profile', icon: UserRound },
    ...(canManage ? [{ id: 'users' as const, label: 'Admin users & roles', icon: UsersRound, count: adminUsers.length }] : []),
    { id: 'roles', label: 'Role permissions', icon: ShieldCheck },
    { id: 'security', label: 'Sessions & security', icon: KeyRound },
    ...(canManage ? [{ id: 'data' as const, label: 'Data', icon: Database }] : []),
  ];
  const requested = params.get('tab') as TabId | null;
  const tab: TabId = tabs.some((t) => t.id === requested) ? (requested as TabId) : 'profile';

  return (
    <>
      <PageHeader title="Settings" subtitle="Your profile, admin access, security and demo data." />
      <Tabs<TabId>
        tabs={tabs}
        value={tab}
        onChange={(id) => setParams(id === 'profile' ? {} : { tab: id }, { replace: true })}
        className="mb-6"
      />
      {tab === 'profile' && <ProfileTab />}
      {tab === 'users' && canManage && <AdminUsersTab />}
      {tab === 'roles' && <RolesTab />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'data' && canManage && <DataTab />}
    </>
  );
}
