import { RecordingCardSkeleton, StatCardSkeleton } from '@/components/skeleton';

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <RecordingCardSkeleton />
        <RecordingCardSkeleton />
        <RecordingCardSkeleton />
        <RecordingCardSkeleton />
      </div>
    </div>
  );
}
