import { useEffect, useMemo, useRef, useState } from 'react';
import { transposeChord, type Song } from '../lib/chordpro';
import {
  chordFunction,
  keyChords,
  normalizeKeyLabel,
  parseKey,
  voiceChord,
} from '../lib/music-theory';
import {
  BASS_INSTRUMENTS,
  DRUM_PADS,
  GROOVES,
  KEY_INSTRUMENTS,
  STRING_INSTRUMENTS,
  rangeLabel,
  type Instrument,
} from '../lib/instruments';
import { voiceBass } from '../lib/bass-voicing';
import type { BassStyle } from '../modules/songbook-overlay';
import type { PadSettings } from '../lib/pad-settings';
import { songChords } from '../lib/song-chords';
import { voiceForStrings } from '../lib/string-voicing';
import { useDrumLoop } from '../lib/drum-loop';
import { Synth } from '../modules/songbook-overlay';
import { MiniKeyboard } from './mini-keyboard';
import { InstrumentPicker } from './instrument-picker';

export type PadsScreenProps = {
  song: Song;
  transpose: number;
  bpm: number;
  settings: PadSettings;
  keys?: Instrument;
  strings?: Instrument;
  /** Left-hand bass instrument for the bass pads. */
  bass?: Instrument;
  onSettings: (patch: Partial<PadSettings>) => void;
  onBack: () => void;
  onFloat: () => void;
};

const FN_LABEL: Record<string, { label: string; color: string }> = {
  tonic: { label: 'Tonic', color: '#4fd18b' },
  sub: { label: 'Subdominant', color: '#5aa8ff' },
  dom: { label: 'Dominant', color: '#ff5c7a' },
  color: { label: 'Color', color: '#c27bff' },
};

const BASS_COLOR = '#5aa8ff';
const BASS_SUB: Record<BassStyle, string> = {
  root: '1',
  fifth: '1-5-8',
  octave: '8va',
};
const BASS_STYLES: { id: BassStyle; label: string }[] = [
  { id: 'octave', label: 'Octave' },
  { id: 'root', label: 'Root' },
  { id: 'fifth', label: '1-5-8' },
];

/** Bass note name for a chord (slash bass wins), e.g. "C/E" -> "E". */
const bassOf = (chord: string) => {
  const m = chord.match(/\/([A-G][#b]?)$/) ?? chord.match(/^([A-G][#b]?)/);
  return m ? m[1] : chord;
};

/**
 * Chord pads + drum pads for a song: three sound layers (keyboard, left-hand bass, and a
 * stringed instrument from around the world) play together from every chord pad, with a lit
 * 5-octave keyboard preview. Also supports computer keyboard shortcuts (1-9, Q-I, Z-M).
 */
export function PadsScreen({
  song,
  transpose,
  bpm,
  settings,
  keys,
  strings,
  bass,
  onSettings,
  onBack,
  onFloat,
}: PadsScreenProps) {
  const [tab, setTab] = useState<'chords' | 'drums'>('chords');
  const [picker, setPicker] = useState<'keys' | 'strings' | 'bass' | null>(
    null
  );
  const [lit, setLit] = useState<{
    keys: number[];
    strings: number[];
    bass: number[];
    chord: string;
  }>({ keys: [], strings: [], bass: [], chord: '' });

  const group = useRef(1);
  const bassGroup = useRef(500000);
  const prev = useRef<number[] | undefined>(undefined);

  const songKey = song.key ? transposeChord(song.key, transpose) : undefined;
  const key = parseKey(normalizeKeyLabel(songKey));
  const fromSong = useMemo(
    () => songChords(song).map((c) => transposeChord(c, transpose)),
    [song, transpose]
  );
  const palette = useMemo(
    () => keyChords(key, false).diatonic.map((c) => c.symbol),
    [key.label]
  );

  const groove = GROOVES.find((g) => g.id === settings.grooveId) ?? GROOVES[0];
  const loop = useDrumLoop(groove, bpm);

  const bassNotes = (chord: string) =>
    bass ? voiceBass(chord, settings.bassStyle, settings.octave, bass.low) : [];

  const press = (chord: string) => {
    if (group.current > 0) Synth.release(group.current);
    group.current += 1;
    const g = group.current;
    const withBass = settings.bassWithChords && !!bass;
    // When the bass layer joins the chord, the keys drop their own bass note (no doubling).
    const keyNotes = keys
      ? voiceChord(
          chord,
          {
            inversion: 'auto',
            style: 'close',
            octave: settings.octave,
            bass: !withBass,
          },
          prev.current
        )
      : [];
    const strNotes = strings
      ? voiceForStrings(chord, strings, settings.octave)
      : [];
    const lhNotes = withBass ? bassNotes(chord) : [];

    if (keys && keyNotes.length) {
      Synth.playNotes(keyNotes, keys.spec, g);
      prev.current = keyNotes;
    }
    if (strings && strNotes.length) {
      Synth.playNotes(strNotes, strings.spec, g);
    }
    if (bass && lhNotes.length) {
      Synth.playNotes(lhNotes, bass.spec, g);
    }
    setLit({ keys: keyNotes, strings: strNotes, bass: lhNotes, chord });
  };

  const release = () => Synth.release(group.current);

  /** Left-hand pad: plays only the bass octave, in its own group so chords and bass can be held together. */
  const pressBass = (chord: string) => {
    if (!bass) return;
    Synth.release(bassGroup.current);
    bassGroup.current += 1;
    const notes = bassNotes(chord);
    Synth.playNotes(notes, bass.spec, bassGroup.current);
    setLit((l) => ({ ...l, bass: notes }));
  };

  const releaseBass = () => Synth.release(bassGroup.current);

  const bassChords = useMemo(
    () =>
      [
        ...new Map([...fromSong, ...palette].map((c) => [bassOf(c), c])).values(),
      ],
    [fromSong, palette]
  );

  // Computer keyboard playability (1-9 for Song Chords, Q-U for Key Chords, Z-M for Bass)
  useEffect(() => {
    if (picker !== null || tab !== 'chords') return undefined;
    const songKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const keyRow = ['q', 'w', 'e', 'r', 't', 'y', 'u'];
    const bassRow = ['z', 'x', 'c', 'v', 'b', 'n', 'm'];
    const held = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const k = e.key.toLowerCase();
      if (held.has(k)) return;

      const sIdx = songKeys.indexOf(k);
      if (sIdx >= 0 && fromSong[sIdx]) {
        held.add(k);
        press(fromSong[sIdx]);
        return;
      }
      const kIdx = keyRow.indexOf(k);
      if (kIdx >= 0 && palette[kIdx]) {
        held.add(k);
        press(palette[kIdx]);
        return;
      }
      const bIdx = bassRow.indexOf(k);
      if (bIdx >= 0 && bassChords[bIdx]) {
        held.add(k);
        pressBass(bassChords[bIdx]);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!held.has(k)) return;
      held.delete(k);
      if (bassRow.includes(k)) {
        releaseBass();
      } else {
        release();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [picker, tab, fromSong, palette, bassChords, keys, strings, bass, settings]);

  return (
    <div className="flex flex-1 flex-col bg-[#0b0d12]">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-[#1d2331] px-4 py-2.5">
        <button
          type="button"
          aria-label="Back to song"
          onClick={() => {
            Synth.stopAll();
            loop.stop();
            onBack();
          }}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-3xl text-[#f3f5f8] hover:bg-[#1b212e]"
        >
          ‹
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold text-[#f3f5f8]">
            Pads · {song.title}
          </h1>
          <p className="text-xs text-[#8d96a8] tabular-nums">
            Key {key.label} · {bpm} BPM
          </p>
        </div>

        <button
          type="button"
          onClick={onFloat}
          aria-label="Float pads over apps"
          className="min-h-[44px] rounded-full bg-[#ff8a1f] px-4 text-sm font-extrabold text-[#111] transition-transform active:scale-95 whitespace-nowrap shrink-0"
        >
          ⧉ Float
        </button>
      </div>

      {/* Mode Tabs */}
      <div className="mx-auto flex w-full max-w-4xl gap-2 px-4 pt-3 pb-1">
        {(['chords', 'drums'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`min-h-[44px] flex-1 rounded-xl text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
              tab === t
                ? 'bg-[#ff8a1f] text-[#111]'
                : 'bg-[#1b212e] text-[#f3f5f8] hover:bg-[#242c3d]'
            }`}
          >
            {t === 'chords' ? '🎹 Chord pads' : '🥁 Drum pads'}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-3 pb-16">
        {tab === 'chords' ? (
          <>
            {/* Three Sound Layers */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setPicker('keys')}
                className="flex min-h-[72px] flex-col justify-center rounded-xl border border-[#ff8a1f]/70 bg-[#12161f] px-3.5 py-2.5 text-left transition-colors hover:bg-[#1b212e]"
              >
                <span className="text-[10px] font-extrabold tracking-wider text-[#ff8a1f]">
                  KEYS LAYER
                </span>
                <span className="mt-0.5 truncate text-sm font-bold text-[#f3f5f8]">
                  {keys?.name ?? 'Off'}
                </span>
                {keys?.category && (
                  <span className="text-[11px] text-[#8d96a8]">
                    {keys.category}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setPicker('bass')}
                className="flex min-h-[72px] flex-col justify-center rounded-xl border border-[#5aa8ff]/70 bg-[#12161f] px-3.5 py-2.5 text-left transition-colors hover:bg-[#1b212e]"
              >
                <span className="text-[10px] font-extrabold tracking-wider text-[#5aa8ff]">
                  LEFT HAND
                </span>
                <span className="mt-0.5 truncate text-sm font-bold text-[#f3f5f8]">
                  {bass?.name ?? 'Off'}
                </span>
                {bass && (
                  <span className="text-[11px] text-[#8d96a8]">
                    {bass.category}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setPicker('strings')}
                className="flex min-h-[72px] flex-col justify-center rounded-xl border border-[#4fd18b]/70 bg-[#12161f] px-3.5 py-2.5 text-left transition-colors hover:bg-[#1b212e]"
              >
                <span className="text-[10px] font-extrabold tracking-wider text-[#4fd18b]">
                  STRINGS LAYER
                </span>
                <span className="mt-0.5 truncate text-sm font-bold text-[#f3f5f8]">
                  {strings?.name ?? 'Off'}
                </span>
                {strings && (
                  <span className="text-[11px] text-[#8d96a8]">
                    {strings.region} · {rangeLabel(strings)}
                  </span>
                )}
              </button>
            </div>

            {/* Octave & Active Chord Row */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8d96a8]">Octave</span>
              {[-1, 0, 1].map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => onSettings({ octave: o })}
                  className={`min-h-[36px] rounded-full px-3.5 text-xs font-semibold tabular-nums transition-colors whitespace-nowrap shrink-0 ${
                    settings.octave === o
                      ? 'bg-[#ff8a1f] text-black'
                      : 'bg-[#1b212e] text-[#f3f5f8] hover:bg-[#252d3e]'
                  }`}
                >
                  {o > 0 ? `+${o}` : o}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-3 text-xs text-[#8d96a8]">
                <span className="hidden sm:inline">
                  Keys: <strong className="text-[#ff8a1f]">Orange</strong> ·
                  Strings: <strong className="text-[#4fd18b]">Green</strong> ·
                  Bass: <strong className="text-[#5aa8ff]">Blue</strong>
                </span>
                <span className="min-w-[48px] text-right font-mono text-base font-extrabold text-[#ffae52]">
                  {lit.chord || '—'}
                </span>
              </div>
            </div>

            {/* 5-Octave Live Keyboard */}
            <MiniKeyboard
              lit={lit.keys}
              litStrings={lit.strings}
              litBass={lit.bass}
              low={24}
              octaves={5}
            />

            {/* Song Chords */}
            {fromSong.length > 0 && (
              <>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8d96a8]">
                    In this song
                  </span>
                  <span className="text-[11px] text-[#8d96a8]">
                    Keyboard shortcuts: 1–{Math.min(9, fromSong.length)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                  {fromSong.map((chord, idx) => {
                    const fn = chordFunction(chord, key);
                    const meta = FN_LABEL[fn];
                    return (
                      <button
                        key={`song-${chord}`}
                        type="button"
                        onPointerDown={() => press(chord)}
                        onPointerUp={release}
                        onPointerLeave={release}
                        style={{ borderColor: `${meta.color}66` }}
                        className="group relative flex min-h-[64px] flex-col items-center justify-center rounded-xl border bg-[#1b212e] px-3 py-2 transition-transform active:scale-[0.97] active:bg-[#3c2c1a] focus:outline-none"
                      >
                        <span className="font-mono text-lg font-extrabold text-[#ffae52]">
                          {chord}
                        </span>
                        <span
                          style={{ color: meta.color }}
                          className="mt-0.5 text-[10px] font-semibold"
                        >
                          {meta.label}
                        </span>
                        {idx < 9 && (
                          <span className="absolute top-1.5 right-2 font-mono text-[10px] text-[#8d96a8]/60">
                            {idx + 1}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Diatonic Key Chords */}
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8d96a8]">
                Key of {key.label}
              </span>
              <span className="text-[11px] text-[#8d96a8]">
                Shortcuts: Q W E R T Y U
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-7">
              {palette.map((chord, idx) => {
                const fn = chordFunction(chord, key);
                const meta = FN_LABEL[fn];
                const keyShortcut = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U'][idx];
                return (
                  <button
                    key={`key-${chord}`}
                    type="button"
                    onPointerDown={() => press(chord)}
                    onPointerUp={release}
                    onPointerLeave={release}
                    style={{ borderColor: `${meta.color}66` }}
                    className="relative flex min-h-[60px] flex-col items-center justify-center rounded-xl border bg-[#1b212e] px-2 py-2 transition-transform active:scale-[0.97] active:bg-[#3c2c1a] focus:outline-none"
                  >
                    <span className="font-mono text-lg font-extrabold text-[#ffae52]">
                      {chord}
                    </span>
                    <span
                      style={{ color: meta.color }}
                      className="text-[10px] font-semibold"
                    >
                      {meta.label}
                    </span>
                    {keyShortcut && (
                      <span className="absolute top-1.5 right-2 font-mono text-[10px] text-[#8d96a8]/60">
                        {keyShortcut}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Left-Hand Bass Section */}
            {bass && (
              <>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#5aa8ff]">
                    Left hand · bass octaves
                  </span>
                  <div className="flex items-center gap-1.5">
                    {BASS_STYLES.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => onSettings({ bassStyle: b.id })}
                        className={`min-h-[32px] rounded-full px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          settings.bassStyle === b.id
                            ? 'bg-[#5aa8ff] text-black'
                            : 'bg-[#1b212e] text-[#f3f5f8]'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {bassChords.map((chord) => (
                    <button
                      key={`b-${chord}`}
                      type="button"
                      onPointerDown={() => pressBass(chord)}
                      onPointerUp={releaseBass}
                      onPointerLeave={releaseBass}
                      aria-label={`Bass ${bassOf(chord)}`}
                      className="flex min-h-[56px] flex-col items-center justify-center rounded-xl border border-[#24405e] bg-[#14202e] transition-transform active:scale-95 active:bg-[#1f3247] focus:outline-none"
                    >
                      <span
                        style={{ color: BASS_COLOR }}
                        className="font-mono text-lg font-black"
                      >
                        {bassOf(chord)}
                      </span>
                      <span className="text-[10px] text-[#8d96a8]">
                        {BASS_SUB[settings.bassStyle]}
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.bassWithChords}
                  onClick={() =>
                    onSettings({ bassWithChords: !settings.bassWithChords })
                  }
                  className="flex min-h-[44px] items-center gap-2.5 text-left focus:outline-none"
                >
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-md border-2 border-[#5aa8ff] ${
                      settings.bassWithChords ? 'bg-[#5aa8ff]' : 'bg-transparent'
                    }`}
                  >
                    {settings.bassWithChords && (
                      <span className="text-xs font-black text-black">✓</span>
                    )}
                  </div>
                  <span className="text-sm text-[#f3f5f8]">
                    Chord pads play the left hand too
                  </span>
                </button>
              </>
            )}

            <p className="text-xs text-[#8d96a8]">
              Hold a pad to sustain. Use one thumb on the bass row and the other
              on chords — or play using your computer keyboard (1–9, Q–U, Z–M).
            </p>
          </>
        ) : (
          /* Drum Pads & 16-Step Groove Loop Tab */
          <>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {DRUM_PADS.map((d) => (
                <button
                  key={d.kind}
                  type="button"
                  onPointerDown={() => Synth.playDrum(d.kind, 0.95)}
                  aria-label={d.name}
                  className="flex min-h-[76px] flex-col items-center justify-center rounded-xl border border-[#283042] bg-[#1b212e] transition-transform active:scale-95 active:bg-[#3c2c1a] focus:outline-none"
                >
                  <span className="font-mono text-xl font-black text-[#6ad3ff]">
                    {d.label}
                  </span>
                  <span className="mt-0.5 text-xs text-[#8d96a8]">{d.name}</span>
                </button>
              ))}
            </div>

            <div className="mt-2 text-[11px] font-extrabold uppercase tracking-wider text-[#8d96a8] tabular-nums">
              Groove loop · {bpm} BPM
            </div>

            <div className="flex flex-wrap gap-2">
              {GROOVES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onSettings({ grooveId: g.id })}
                  className={`min-h-[38px] rounded-full px-4 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    settings.grooveId === g.id
                      ? 'bg-[#ff8a1f] text-black'
                      : 'bg-[#1b212e] text-[#f3f5f8] hover:bg-[#252d3d]'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>

            {/* 16-Step Indicator Bar */}
            <div className="flex gap-1 py-1">
              {Array.from({ length: 16 }, (_, i) => (
                <div
                  key={i}
                  className={`h-3 flex-1 rounded-xs transition-colors ${
                    loop.step === i
                      ? 'bg-[#ff8a1f]'
                      : i % 4 === 0
                      ? 'bg-[#283042]'
                      : 'bg-[#1b212e]'
                  }`}
                />
              ))}
            </div>

            {/* Shorthand Step Grid */}
            <div className="rounded-xl border border-[#1d2331] bg-[#12161f] p-3.5 space-y-1">
              {Object.entries(groove.rows).map(([k, row]) => (
                <div
                  key={k}
                  className="font-mono text-sm tracking-widest text-[#f3f5f8]"
                >
                  <span className="inline-block w-10 font-bold text-[#6ad3ff]">
                    {DRUM_PADS.find((d) => d.kind === k)?.label ?? k}
                  </span>
                  <span>{row}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={loop.toggle}
              className={`mt-1 min-h-[52px] w-full rounded-xl border border-[#ff8a1f] text-base font-extrabold transition-colors whitespace-nowrap shrink-0 ${
                loop.playing
                  ? 'bg-[#ff8a1f] text-black'
                  : 'bg-transparent text-[#ff8a1f] hover:bg-[#ff8a1f]/10'
              }`}
            >
              {loop.playing ? '■ Stop loop' : '▶ Play loop'}
            </button>
          </>
        )}
      </div>

      {/* Layer Pickers */}
      <InstrumentPicker
        visible={picker === 'keys'}
        title="Keys layer — pianos, synths, mallets"
        instruments={KEY_INSTRUMENTS}
        selectedId={settings.keysId}
        categoryFilter
        onSelect={(id) => onSettings({ keysId: id })}
        onClose={() => setPicker(null)}
      />
      <InstrumentPicker
        visible={picker === 'bass'}
        title="Left hand — bass sounds"
        instruments={BASS_INSTRUMENTS}
        selectedId={settings.bassId}
        categoryFilter
        onSelect={(id) => onSettings({ bassId: id })}
        onClose={() => setPicker(null)}
      />
      <InstrumentPicker
        visible={picker === 'strings'}
        title="Strings layer — instruments of the world"
        instruments={STRING_INSTRUMENTS}
        eraFilter
        selectedId={settings.stringsId}
        onSelect={(id) => onSettings({ stringsId: id })}
        onClose={() => setPicker(null)}
      />
    </div>
  );
}
