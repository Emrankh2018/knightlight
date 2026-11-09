import type { ReactNode } from 'react';
import Board, { type BoardProps } from '../Board';

interface ArcadeBoardProps extends Pick<BoardProps, 'fen' | 'interactive' | 'onMove' | 'kingless' | 'moveFilter' | 'lastMove' | 'promotion'> {
  label: string;
  children: ReactNode;
}

export default function ArcadeBoard({ label, children, ...board }: ArcadeBoardProps) {
  return (
    <div className="kl-arcade-match">
      <div className="min-w-0 -mx-3.5 p-2 lg:mx-0">
        <Board {...board} ariaLabel={label} size="var(--kl-arcade-board)" cleanSquares />
      </div>
      <div className="min-w-0 space-y-3">{children}</div>
    </div>
  );
}
