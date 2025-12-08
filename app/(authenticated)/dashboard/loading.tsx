import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={`credit-chip-${idx}`}
              className="flex items-center gap-2 px-3 py-2 bg-muted/30 border border-border/40 rounded-full"
            >
              <Skeleton className="h-6 w-6 rounded-full" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-32" />
          </div>

          {Array.from({ length: 3 }).map((_, cardIdx) => (
            <div key={`event-card-${cardIdx}`} className="rounded-lg border border-border/40 bg-card/40">
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-64" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 5 }).map((_, buttonIdx) => (
                    <Skeleton key={`event-card-${cardIdx}-button-${buttonIdx}`} className="h-9 w-28" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="w-full">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-8" />
          </div>
          <div className="mt-4 space-y-4">
            {Array.from({ length: 2 }).map((_, archiveIdx) => (
              <div key={`archive-card-${archiveIdx}`} className="rounded-lg border border-border/30 bg-card/30">
                <div className="p-4 space-y-3">
                  <Skeleton className="h-4 w-48" />
                  <div className="flex gap-2">
                    {Array.from({ length: 3 }).map((_, actionIdx) => (
                      <Skeleton key={`archive-card-${archiveIdx}-action-${actionIdx}`} className="h-9 w-24" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
