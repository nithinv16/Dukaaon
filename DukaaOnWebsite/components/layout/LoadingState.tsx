export function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-light">
      <div className="text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary-orange to-accent-yellow animate-pulse">
          <span className="text-3xl font-bold text-white">D</span>
        </div>
        <p className="mt-4 text-sm text-primary-gray">Loading...</p>
      </div>
    </div>
  );
}

export function PageLoadingSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header Skeleton */}
      <div className="h-16 bg-neutral-light border-b border-neutral-medium" />
      
      {/* Content Skeleton */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-4">
          <div className="h-8 bg-neutral-light rounded w-3/4" />
          <div className="h-4 bg-neutral-light rounded w-1/2" />
          <div className="h-4 bg-neutral-light rounded w-2/3" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-neutral-light rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
