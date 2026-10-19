import { useSettings } from '../store/settings';

/** Sound effects synthesised with the Web Audio API: no audio files are shipped. */

export type SoundKind = 'move' | 'capture' | 'check' | 'checkmate' | 'castle' | 'promotion' | 'wrong' | 'hint' | 'solved';

/** Which sound a move makes, from its SAN (chess.js adds 'x', '+', '#', '=' and O-O for us). Most dramatic first. */
export function soundForMove(san: string): SoundKind {
  if (san.includes('#')) return 'checkmate';
  if (san.includes('+')) return 'check';
  if (san.includes('=')) return 'promotion';
  if (san.startsWith('O-O')) return 'castle';
  if (san.includes('x')) return 'capture';
  return 'move';
}

interface Note {
  /** Seconds after the sound starts. */
  at: number;
  dur: number;
  from: number;
  to?: number;
  type: OscillatorType;
  gain: number;
}

const tick = (at: number): Note[] => [
  { at, dur: 0.07, from: 430, to: 290, type: 'triangle', gain: 0.55 },
  { at, dur: 0.05, from: 170, type: 'sine', gain: 0.4 },
];

const arpeggio: Note[] = [523.25, 659.25, 783.99, 1046.5].map((f, i, all) => ({
  at: i * 0.11,
  dur: i === all.length - 1 ? 0.45 : 0.16,
  from: f,
  type: 'sine',
  gain: 0.4,
}));

const SOUNDS: Record<SoundKind, Note[]> = {
  move: tick(0),
  capture: [
    { at: 0, dur: 0.12, from: 320, to: 150, type: 'triangle', gain: 0.75 },
    { at: 0, dur: 0.14, from: 110, type: 'sine', gain: 0.6 },
  ],
  check: [
    { at: 0, dur: 0.14, from: 660, type: 'sine', gain: 0.35 },
    { at: 0.14, dur: 0.2, from: 880, type: 'sine', gain: 0.35 },
  ],
  checkmate: arpeggio,
  solved: arpeggio,
  castle: [...tick(0), ...tick(0.12)],
  promotion: [
    { at: 0, dur: 0.12, from: 523.25, type: 'sine', gain: 0.35 },
    { at: 0.08, dur: 0.12, from: 783.99, type: 'sine', gain: 0.35 },
    { at: 0.16, dur: 0.3, from: 1046.5, type: 'sine', gain: 0.35 },
  ],
  wrong: [{ at: 0, dur: 0.28, from: 170, to: 130, type: 'triangle', gain: 0.45 }],
  hint: [
    { at: 0, dur: 0.3, from: 988, type: 'sine', gain: 0.22 },
    { at: 0.09, dur: 0.4, from: 1319, type: 'sine', gain: 0.18 },
  ],
};

/** Overall ceiling so that full volume is still comfortable in a quiet classroom. */
const CEILING = 0.5;

type ContextCtor = new () => AudioContext;

function contextCtor(): ContextCtor | null {
  const g = globalThis as { AudioContext?: ContextCtor; webkitAudioContext?: ContextCtor };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

let ctx: AudioContext | null = null;
let failed = false;

/** Creates (once) and resumes the AudioContext. Must run from a user gesture; never throws. */
export function unlockAudio(): void {
  try {
    if (failed) return;
    if (ctx && (ctx.state as string) === 'closed') ctx = null;
    if (!ctx) {
      const Ctor = contextCtor();
      if (!Ctor) {
        failed = true;
        return;
      }
      ctx = new Ctor();
    }
    if ((ctx.state as string) !== 'running') void ctx.resume().catch(() => undefined);
  } catch {
    failed = true;
  }
}

if (typeof window !== 'undefined') {
  for (const type of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(type, unlockAudio, { passive: true });
}

function schedule(audio: AudioContext, kind: SoundKind, volume: number): void {
  const master = audio.createGain();
  master.gain.value = volume * CEILING;
  master.connect(audio.destination);
  const t0 = audio.currentTime;
  for (const n of SOUNDS[kind]) {
    const osc = audio.createOscillator();
    const env = audio.createGain();
    const start = t0 + n.at;
    osc.type = n.type;
    osc.frequency.setValueAtTime(n.from, start);
    if (n.to !== undefined) osc.frequency.exponentialRampToValueAtTime(n.to, start + n.dur);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(n.gain, start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
    osc.connect(env);
    env.connect(master);
    osc.start(start);
    osc.stop(start + n.dur + 0.05);
  }
}

/** Plays a sound unless muted. Silent (and safe) before the first user gesture or when Web Audio is unavailable. */
export function playSound(kind: SoundKind): void {
  const { sound, volume } = useSettings.getState();
  if (!sound || volume <= 0 || !ctx || failed) return;
  try {
    if ((ctx.state as string) === 'closed') {
      unlockAudio();
      if (!ctx || failed) return;
    }
    const audio = ctx;
    // Safari/iOS can also report 'interrupted', which the TS type does not list.
    if ((audio.state as string) !== 'running') {
      void audio.resume().then(() => schedule(audio, kind, volume), () => undefined);
      return;
    }
    schedule(audio, kind, volume);
  } catch {
    failed = true;
  }
}

/** Plays the sound for a move given its SAN. */
export function playMoveSound(san: string): void {
  playSound(soundForMove(san));
}
