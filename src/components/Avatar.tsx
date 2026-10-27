const SIZES = {
  sm: 'h-9 w-9 text-xl',
  md: 'h-11 w-11 text-2xl',
  lg: 'h-14 w-14 text-3xl',
  xl: 'h-20 w-20 text-5xl',
} as const;

/**
 * A profile avatar in a consistent lamplit badge.
 * `value` is the stored avatar string (an emoji today). Keep it as the stored id: this component is
 * the one place to swap in original SVG art later without changing saved profiles or backups.
 */
export default function Avatar({ value, size = 'md', className = '' }: { value: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-lamp/70 leading-none ring-2 ring-amber/70 dark:bg-ink-soft dark:ring-amber/60 ${SIZES[size]} ${className}`.trim()}
    >
      {value}
    </span>
  );
}
