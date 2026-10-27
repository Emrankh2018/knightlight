import type { ReactNode } from 'react';
import { fmt, m } from '../i18n';

interface RingProps {
  /** 0..1 */
  value: number;
  label: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}

export default function Ring({ value, label, size = 96, stroke = 10, children }: RingProps) {
  const v = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const percent = Math.round(v * 100);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={fmt(m().ring.label, { label, percent })}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--kl-line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-amber)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.7s ease-out' }}
        />
      </svg>
      {children ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-center font-extrabold" aria-hidden="true">
          {children}
        </span>
      ) : null}
    </div>
  );
}
