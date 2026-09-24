import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isSessionValid, justSignedOut, signOut, useCurrentAdmin, useSession } from '@/store/auth';

/** Redirects to /login?next=… unless there is a valid session for an active admin user. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession();
  const admin = useCurrentAdmin();
  const location = useLocation();
  const valid = isSessionValid(session);
  const deactivated = valid && (!admin || !admin.active);
  const expired = !!session && !valid;

  useEffect(() => {
    if (expired) signOut('expired');
    else if (deactivated) signOut('deactivated');
  }, [expired, deactivated]);

  if (!valid || deactivated) {
    // A deliberate sign-out goes to a clean login page (no "next")
    if (!session && justSignedOut()) return <Navigate to="/login" replace />;
    const next = encodeURIComponent(location.pathname + location.search);
    const reason = expired ? '&reason=expired' : deactivated ? '&reason=deactivated' : '';
    return <Navigate to={`/login?next=${next}${reason}`} replace />;
  }
  return <>{children}</>;
}
