/**
 * Pulsing placeholder block. Use for any element whose content
 * is fetched asynchronously, so the user sees motion instead of
 * a blank pane and assumes the app is working.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded animate-pulse bg-bg-inset ${className}`} />;
}
