/**
 * Ops variant of the Beacon mark — same six lines + center dot, but
 * enclosed in a thin rounded square so it visually distinguishes the
 * mission-control surface from the customer-facing dashboard. The
 * frame doubles as a "console / command-center" cue.
 */
export function BeaconMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {/* Console frame — distinguishes ops from the dashboard mark. */}
      <rect x="3" y="3" width="58" height="58" rx="10" strokeWidth={2} />
      {/* Converge mark, sized down a touch to sit comfortably inside. */}
      <path d="M14 19 L32 32" />
      <path d="M50 19 L32 32" />
      <path d="M14 32 L32 32" />
      <path d="M50 32 L32 32" />
      <path d="M14 45 L32 32" />
      <path d="M50 45 L32 32" />
      <circle cx="32" cy="32" r="4.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
