import { useId } from 'react';
import { Chessboard } from 'react-chessboard';
import { BOARD_THEMES, effectiveBoardTheme, useIsDark, useSettings } from '../store/settings';

/** A small, non-interactive board for thumbnails. Not focusable and hidden from assistive tech (the card text carries the meaning). */
export default function MiniBoard({ fen, size = 112, orientation = 'white' }: { fen: string; size?: number; orientation?: 'white' | 'black' }) {
  const boardTheme = useSettings((s) => s.boardTheme);
  const dark = useIsDark();
  const uid = useId();
  const colors = BOARD_THEMES[effectiveBoardTheme(boardTheme, dark)];
  return (
    <div aria-hidden="true" inert className="kl-board-frame shrink-0" style={{ width: size, height: size, pointerEvents: 'none' }}>
      <Chessboard
        options={{
          id: `kl-mini-${uid}`,
          position: fen,
          boardOrientation: orientation,
          allowDragging: false,
          allowDrawingArrows: false,
          showNotation: false,
          showAnimations: false,
          lightSquareStyle: { backgroundColor: colors.light },
          darkSquareStyle: { backgroundColor: colors.dark },
        }}
      />
    </div>
  );
}
