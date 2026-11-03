import { Synth } from '../modules/songbook-overlay';
import { KEY_INSTRUMENTS } from '../lib/instruments';
import { colors } from '../lib/theme';

const BLACK = new Set([1, 3, 6, 8, 10]);

export type MiniKeyboardProps = {
  /** Lowest MIDI note shown (a C, default 36 = C2). */
  low?: number;
  /** Number of octaves. */
  octaves?: number;
  /** Keyboard/melody-layer notes to light (orange). */
  lit: number[];
  /** Strings-layer notes to light (green). */
  litStrings?: number[];
  /** Left-hand bass notes to light (blue). */
  litBass?: number[];
};

const PREVIEW_GROUP = 990001;

/**
 * Interactive 3-layer piano keyboard that lights the notes of the current chord or melody
 * across Keys (orange), Strings (green), and Left-Hand Bass (blue).
 */
export function MiniKeyboard({
  low = 36,
  octaves = 4,
  lit,
  litStrings = [],
  litBass = [],
}: MiniKeyboardProps) {
  const high = low + octaves * 12;
  const keysLit = new Set(lit);
  const strLit = new Set(litStrings);
  const bassLit = new Set(litBass);

  const whites: number[] = [];
  for (let n = low; n < high; n += 1) {
    if (!BLACK.has(n % 12)) whites.push(n);
  }
  const w = 100 / whites.length;

  const tint = (n: number, white: boolean) => {
    if (keysLit.has(n)) return colors.accent;
    if (strLit.has(n)) return '#4fd18b';
    if (bassLit.has(n)) return '#5aa8ff';
    return white ? '#e9ecf2' : '#1b1f27';
  };

  const auditionNote = (midi: number) => {
    Synth.release(PREVIEW_GROUP);
    Synth.playNotes([midi], KEY_INSTRUMENTS[0].spec, PREVIEW_GROUP);
    setTimeout(() => Synth.release(PREVIEW_GROUP), 320);
  };

  return (
    <div
      role="img"
      aria-label="Chord notes on keyboard"
      className="relative flex h-16 w-full select-none overflow-hidden rounded-lg border border-[#283042] bg-black"
    >
      {whites.map((n) => {
        const isLit = keysLit.has(n) || strLit.has(n) || bassLit.has(n);
        return (
          <button
            key={n}
            type="button"
            onPointerDown={() => auditionNote(n)}
            style={{
              width: `${w}%`,
              backgroundColor: tint(n, true),
            }}
            className={`h-full border-r border-[#9aa1ad]/70 transition-colors duration-75 focus:outline-none ${
              isLit ? 'brightness-105' : 'hover:brightness-95'
            }`}
            aria-label={`MIDI note ${n}`}
          />
        );
      })}
      {whites.map((n, i) =>
        BLACK.has((n + 1) % 12) && n + 1 < high ? (
          <button
            key={`b${n}`}
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              auditionNote(n + 1);
            }}
            style={{
              left: `${(i + 1) * w - w * 0.32}%`,
              width: `${w * 0.64}%`,
              backgroundColor: tint(n + 1, false),
            }}
            className="absolute top-0 z-10 h-[60%] rounded-b-[3px] border border-black/60 transition-colors duration-75 focus:outline-none"
            aria-label={`MIDI sharp note ${n + 1}`}
          />
        ) : null
      )}
    </div>
  );
}
