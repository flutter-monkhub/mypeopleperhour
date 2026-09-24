import { cn } from '@/lib/cn';

/** Shimmer block — size it with className (h-4 w-32, size-10 rounded-full, …). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-md', className)} aria-hidden />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={cn('rounded-card border border-line bg-white p-5 shadow-card', className)} aria-hidden>
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="size-9 rounded-lg" />
        <Skeleton className="h-4 w-40" />
      </div>
      <SkeletonText lines={lines} />
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn('divide-y divide-line', className)} aria-hidden>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 px-5 py-3.5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          {Array.from({ length: cols - 1 }, (_, c) => (
            <Skeleton key={c} className={cn('h-3.5', c === 0 ? 'w-40' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Suspense fallback for lazy pages. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
      <div className="rounded-card border border-line bg-white shadow-card">
        <SkeletonTable rows={6} />
      </div>
    </div>
  );
}
