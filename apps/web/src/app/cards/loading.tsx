export default function CardsLoading() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="h-8 w-40 bg-surface-elevated rounded animate-pulse mb-6" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-card border border-surface-border overflow-hidden">
              <div className="aspect-[2/3] bg-surface-elevated animate-pulse" />
              <div className="p-2 space-y-1">
                <div className="h-3 bg-surface-elevated rounded animate-pulse" />
                <div className="h-3 w-16 bg-surface-elevated rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
