import { useRef } from 'react';
import { fmt, m } from '../i18n';
import { playSound, unlockAudio } from '../lib/sound';
import { useSettings } from '../store/settings';

/** Speaker button (mute toggle); optionally with a volume slider. `compact` is the large Class Mode mute button (no slider). */
export default function SoundToggle({ volume = false, compact = false, className = 'hover:bg-ink-soft' }: { volume?: boolean; compact?: boolean; className?: string }) {
  const on = useSettings((s) => s.sound);
  const level = useSettings((s) => s.volume);
  const setSound = useSettings((s) => s.setSound);
  const setVolume = useSettings((s) => s.setVolume);
  const timer = useRef<number | undefined>(undefined);
  const previewSoon = (): void => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => playSound('move'), 150);
  };
  const toggle = (): void => {
    unlockAudio();
    setSound(!on);
    if (!on) window.setTimeout(() => playSound('move'), 0);
  };
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-pressed={on}
        aria-label={m().sound.toggle}
        title={on ? m().sound.on : m().sound.off}
        onClick={toggle}
        className={`flex items-center justify-center rounded-lg text-xl ${compact ? 'min-h-14 min-w-14 border-2 border-line bg-surface text-2xl' : 'min-h-11 min-w-11'} ${className}`}
      >
        <span aria-hidden="true">{on ? '🔊' : '🔇'}</span>
      </button>
      {volume && !compact ? (
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={level}
          disabled={!on}
          aria-label={m().sound.volume}
          aria-valuetext={fmt(m().sound.volumeValue, { percent: Math.round(level * 100) })}
          onChange={(e) => setVolume(Number(e.target.value))}
          onPointerUp={() => playSound('move')}
          onKeyUp={previewSoon}
          className="h-11 w-28 accent-amber"
        />
      ) : null}
    </span>
  );
}
