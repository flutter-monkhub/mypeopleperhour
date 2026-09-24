import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Compass, LayoutDashboard } from 'lucide-react';
import { Button, Card, LinkButton } from '@/components/ui';

/** 404 — catch-all route inside the app shell. */
export default function NotFoundPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <div className="grid min-h-[calc(100vh-10rem)] place-items-center">
      <Card padding="lg" className="w-full max-w-xl text-center">
        <div className="relative mx-auto mb-4 w-fit">
          <p className="text-brand-gradient text-[88px] leading-none font-extrabold tracking-tighter select-none">404</p>
          <span className="absolute -right-5 -bottom-1 grid size-11 place-items-center rounded-full border-4 border-white bg-primary text-white shadow-card">
            <Compass className="size-5" />
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">We couldn’t find that page</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">
          <code className="rounded bg-neutral-soft px-1.5 py-0.5 text-[13px] text-ink">{pathname}</code> doesn’t exist or may have moved. Check the address, or head back to the dashboard.
        </p>
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
