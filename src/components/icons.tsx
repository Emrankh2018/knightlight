import type { ReactNode, SVGProps } from 'react';

/** Original stroke icons (24px grid, currentColor). Decorative: pair with a text label or aria-label on the parent. */
function Icon({ children, ...rest }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1.5rem"
      height="1.5rem"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement>;

export const SunIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
  </Icon>
);

export const MoonIcon = (p: P) => (
  <Icon {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </Icon>
);

export const MonitorIcon = (p: P) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </Icon>
);

export const VolumeIcon = (p: P) => (
  <Icon {...p}>
    <path d="M11 5 6 9H3v6h3l5 4z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </Icon>
);

export const VolumeOffIcon = (p: P) => (
  <Icon {...p}>
    <path d="M11 5 6 9H3v6h3l5 4z" />
    <path d="m16 9 6 6M22 9l-6 6" />
  </Icon>
);

export const MenuIcon = (p: P) => (
  <Icon {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Icon>
);

export const CloseIcon = (p: P) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

/** Streak flame: filled, so it keeps its warm colour on any surface. */
export const FlameIcon = (p: P) => (
  <Icon {...p} fill="currentColor" strokeWidth={1.5}>
    <path d="M12 2c1.5 3.5 6 6 6 12a6 6 0 0 1-12 0c0-2.2 1-4 2.5-5.5.3 1.7 1.2 2.7 2.5 3C10.5 8.5 10.5 5 12 2z" />
  </Icon>
);
