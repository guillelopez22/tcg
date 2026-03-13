export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
          <div className="aspect-[2/3] bg-surface-elevated animate-pulse" />
          <div className="p-2.5 space-y-2">
            <div className="h-3.5 bg-surface-elevated rounded animate-pulse w-3/4" />
            <div className="h-3 bg-surface-elevated rounded animate-pulse w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden divide-y divide-surface-border">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="w-10 h-10 rounded-lg bg-surface-elevated animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-surface-elevated rounded animate-pulse w-2/3" />
            <div className="h-3 bg-surface-elevated rounded animate-pulse w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="h-4 w-24 bg-surface-elevated rounded animate-pulse" />
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="w-full sm:w-[240px] aspect-[2/3] rounded-xl bg-surface-elevated animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-4">
          <div className="h-7 bg-surface-elevated rounded animate-pulse w-3/4" />
          <div className="h-4 bg-surface-elevated rounded animate-pulse w-1/2" />
          <div className="h-4 bg-surface-elevated rounded animate-pulse w-full" />
          <div className="h-4 bg-surface-elevated rounded animate-pulse w-2/3" />
        </div>
      </div>
    </div>
  );
}
