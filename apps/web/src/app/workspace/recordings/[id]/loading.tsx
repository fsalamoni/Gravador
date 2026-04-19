import { Skeleton, TabContentSkeleton } from '@/components/skeleton';

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-40 rounded-full" />
        </div>
      </div>
      <div className="rounded-[28px] border border-border bg-bg/55 p-5">
        <Skeleton className="h-[104px] w-full rounded-[22px]" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-full" />
        ))}
      </div>
      <TabContentSkeleton />
    </div>
  );
}
