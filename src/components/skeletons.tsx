import { Skeleton } from "@/components/ui/skeleton";

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}

export function ShopHeaderSkeleton() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background lg:max-w-2xl">
      <Skeleton className="h-40 w-full rounded-none" />
      <div className="-mt-10 space-y-3 px-4">
        <div className="flex items-end gap-3">
          <Skeleton className="h-20 w-20 shrink-0 rounded-2xl border-4 border-background" />
          <div className="flex-1 space-y-2 pb-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="grid grid-cols-2 gap-3 pt-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background lg:max-w-2xl">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-4 px-4 pt-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function ConversationListSkeleton() {
  return (
    <div className="space-y-1 px-4 pt-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessagesSkeleton() {
  return (
    <div className="space-y-3 p-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={i % 2 === 0 ? "flex justify-start" : "flex justify-end"}>
          <Skeleton className={i % 2 === 0 ? "h-9 w-40 rounded-2xl rounded-bl-md" : "h-9 w-32 rounded-2xl rounded-br-md"} />
        </div>
      ))}
    </div>
  );
}

export function AdminMetricsSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    </div>
  );
}

export function ShopListSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
          <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
