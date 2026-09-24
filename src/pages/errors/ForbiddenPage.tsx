import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard, ShieldAlert } from 'lucide-react';
import type { AdminPermission } from '@shared/types';
import { PERMISSION_META, ROLE_META } from '@/lib/rbac';
import { useCurrentAdmin } from '@/store/auth';
import { Badge, Button, Card, LinkButton } from '@/components/ui';

/** 403 — rendered by <RequirePermission> (inside the layout) and at /403. */
export default function ForbiddenPage({ missing }: { missing?: AdminPermission }) {
  const admin = useCurrentAdmin();
  const navigate = useNavigate();
  const role = admin ? ROLE_META[admin.role] : null;
  return (
    <div className="grid min-h-[calc(100vh-10rem)] place-items-center">
      <Card padding="lg" className="w-full max-w-xl text-center">
        <div className="relative mx-auto mb-5 grid size-20 place-items-center">
          <span className="absolute inset-0 rounded-full bg-danger-soft" />
          <span className="absolute inset-2.5 rounded-full bg-[#FBD5D5]" />
          <ShieldAlert className="relative size-9 text-danger" strokeWidth={1.8} />
        </div>
        <p className="text-sm font-semibold tracking-wide text-danger">Error 403 · Access restricted</p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-ink">You don’t have access to this page</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-2">
          {role ? (
            <>
              Your role <strong className="font-semibold text-ink">{role.label}</strong> doesn’t include
              {missing ? (
                <>
                  {' '}
                  <strong className="font-semibold text-ink">{PERMISSION_META[missing].label.toLowerCase()}</strong> ({PERMISSION_META[missing].module})
                </>
              ) : (
                ' this area'
              )}
              . If you need it, ask a super admin to update your role.
            </>
          ) : (
            'Sign in with an admin account that has access to this area.'
          )}
        </p>
        {role && (
          <div className="mt-4 flex justify-center">
            <Badge tone={role.tone}>{role.access}</Badge>
          </div>
        )}
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(-1)}>
            Go back
          </Button>
          <LinkButton to="/dashboard" icon={LayoutDashboard}>
            Go to dashboard
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}
