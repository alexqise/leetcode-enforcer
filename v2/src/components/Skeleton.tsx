interface SkeletonProps {
  /** Tailwind sizing classes, e.g. "w-60 h-4" */
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <span
      className={`inline-block h-3 rounded-sm bg-surface-2 align-middle motion-safe:animate-skeleton ${className}`}
    />
  )
}
