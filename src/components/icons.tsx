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

/** Original filled piece silhouettes for the bot levels and course badges. */
const PIECE_PATHS = {
  pawn: 'M12 4.2a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4zM8.6 20c0-4 1.5-6.4 3.4-7.6 1.900 1.200 3.400 3.600 3.400 7.600zM6.500 20h11v2h-11z',
  knight: 'M7 22v-2h11v2zM8.500 20c0-4 .9-6.200 2.800-8.200-2.100.2-3.900 1.400-5.100 3.200L4.800 13l4.200-6.800L10.200 3l2 1 2.300-1c3.200 2 5.500 5.300 5.500 9.700 0 2.600-.2 5.300-1 7.300z',
  bishop: 'M12 2.200a1.700 1.700 0 1 1 0 3.400 1.700 1.700 0 0 1 0-3.400zM12 6.500c3.200 2.200 5.200 5 5.200 8 0 1.900-.8 3.200-2 4.500H8.800c-1.200-1.300-2-2.600-2-4.500 0-3 2-5.800 5.200-8zM6.500 20h11v2h-11z',
  rook: 'M6.500 22v-2h11v2zM7.500 20l1-8h7l1 8zM7 11V5.500h2.200v2H11v-2h2v2h1.800v-2H17V11z',
  queen: 'M4.500 8l3.200 6 2.300-8.500L12 12l2-6.500 2.300 8.500 3.200-6-2 12.500H6.500zM6.500 20.500h11v1.700h-11z',
} as const;
export type PieceName = keyof typeof PIECE_PATHS;

export const PieceIcon = ({ piece, ...p }: P & { piece: PieceName }) => (
  <Icon {...p} fill="currentColor" stroke="none">
    <path d={PIECE_PATHS[piece]} />
  </Icon>
);
