'use client';

export function Skeleton({
  className = '',
  style,
}: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-[24px] bg-surface/80 ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function RecordingCardSkeleton() {
  return (
    <div className="rounded-[24px] border border-border bg-bg/55 p-5 space-y-4" aria-hidden="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>
      <Skeleton className="h-6 w-3/4" />
      <div className="flex h-16 items-end gap-1.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-full"
            style={{ height: `${20 + Math.random() * 40}px` }}
          />
        ))}
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-[24px] border border-border bg-bg/55 p-4 space-y-3" aria-hidden="true">
      <Skeleton className="h-5 w-5 rounded-lg" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-4 w-24 rounded-full" />
    </div>
  );
}

export function TranscriptSegmentSkeleton() {
  return (
    <div className="rounded-[24px] border border-border bg-bg/55 p-4 space-y-3" aria-hidden="true">
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}

export function TabContentSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading content">
      <TranscriptSegmentSkeleton />
      <TranscriptSegmentSkeleton />
      <TranscriptSegmentSkeleton />
      <TranscriptSegmentSkeleton />
    </div>
  );
}
