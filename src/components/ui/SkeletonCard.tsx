const shimmerBase = 'animate-[shimmer_1.5s_ease-in-out_infinite] bg-[length:200%_100%] bg-[linear-gradient(90deg,transparent_25%,rgba(255,255,255,0.06)_50%,transparent_75%)]'

/**
 * Skeleton placeholder for a single product card.
 * Matches the same rounded-[28px] card shape as CatalogProductCard.
 */
export function SkeletonProductCard() {
  return (
    <article className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
      {/* Image area */}
      <div className={`aspect-square w-full bg-white/4 ${shimmerBase}`} />

      {/* Info section */}
      <div className="px-3 pb-4 pt-3 space-y-2.5">
        {/* Name line */}
        <div className={`h-4 w-3/4 rounded-md bg-white/8 ${shimmerBase}`} />
        {/* Brand/category line */}
        <div className={`h-3 w-1/2 rounded-md bg-white/6 ${shimmerBase}`} />
        {/* Price */}
        <div className={`mt-2 h-3.5 w-1/3 rounded-md bg-white/8 ${shimmerBase}`} />
      </div>
    </article>
  )
}

/**
 * 2-column skeleton grid matching the product grid layout.
 * Shows 6 skeleton cards by default.
 */
export function SkeletonProductGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonProductCard key={index} />
      ))}
    </div>
  )
}
