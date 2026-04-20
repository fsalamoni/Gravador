import { Skeleton } from '@/components/skeleton';

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-full rounded-[22px]" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-20 w-full rounded-[22px]" />
          <Skeleton className="h-20 w-full rounded-[22px]" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-20 w-full rounded-[22px]" />
          <Skeleton className="h-20 w-full rounded-[22px]" />
        </div>
      </div>
    </div>
  );
}
