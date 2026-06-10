export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3 w-3 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin ${className}`}
    />
  )
}
