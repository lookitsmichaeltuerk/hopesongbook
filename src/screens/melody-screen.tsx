import { useEffect, useMemo, useRef, useState } from 'react';
import type { Song } from '../lib/chordpro';
import { useMelodyPlayer } from '../lib/melody-player';
import { melodyVoices, harmonizeNote } from '../lib/melody-voices';
import { useLiteMode, LITE_CHORD_SPEC, LITE_MELODY_SPEC } from '../lib/lite-mode';
import { MiniKeyboard } from './mini-keyboard';
import type { Instrument } from '../lib/instruments';
import { voiceChord } from '../lib/music-theory';
import { Synth } from '../modules/songbook-overlay';

export type MelodyScreenProps = {
  song: Song;
  transpose: number;
  bpm: number;
  /** Current keys-layer instrument, used for the chord backing. */
  keys?: Instrument | null;
  octave: number;
  onBpm: (bpm: number) => void;
  onBack: () => void;
};

const BEAT_W = 38;
const ROLL_H = 160;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = (m: number) =>
  `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;

const SUGGESTION_GROUP = 880005;

/**
 * Plays the melody imported from a lead sheet: a piano-roll lane with lyric syllables and
 * chord changes, a keyboard that lights the melody (orange) and the chord (green), voice and
 * backing choices, tempo control, bar looping, and chord suggestions for the current note.
 */
export function MelodyScreen({
  song,
  transpose,
  bpm,
  keys,
  octave,
  onBpm,
  onBack,
}: MelodyScreenProps) {
  const melody = song.melody!;
  const voices = useMemo(() => melodyVoices(), []);
  const [voiceIdx, setVoiceIdx] = useState(0);
  const [backing, setBacking] = useState(true);
  const [loopBar, setLoopBar] = useState<number | null>(null);
  const beatsPerBar = Number(song.time.split('/')[0]) || 4;
  const loop =
    loopBar === null
      ? null
      : { start: loopBar * beatsPerBar, end: (loopBar + 1) * beatsPerBar };
  const voice = voices[voiceIdx];
  const [lite, setLite] = useLiteMode();

  const melodySpec = useMemo(
    () => (lite && voice.spec ? LITE_MELODY_SPEC : voice.spec),
    [lite, voice]
  );
  const chordSpec = useMemo(() => {
    if (!backing) return null;
    if (lite) return LITE_CHORD_SPEC;
    return keys ? { ...keys.spec, gain: keys.spec.gain * 0.55 } : LITE_CHORD_SPEC;
  }, [backing, lite, keys]);

  const player = useMelodyPlayer({
    melody,
    bpm,
    transpose,
    melodySpec,
    chordSpec,
    octave,
    loop,
    uiTickMs: lite ? 0 : 200,
    maxChordNotes: lite ? 3 : undefined,
  });

  const { state } = player;
  const rollRef = useRef<HTMLDivElement>(null);

  const [lo, hi] = useMemo(() => {
    const ms = melody.notes.map((n) => n.midi);
    return [Math.min(...ms), Math.max(...ms)];
  }, [melody]);

  const span = Math.max(12, hi - lo + 2);
  const yOf = (m: number) =>
    ROLL_H - 16 - ((m - lo + 1) / span) * (ROLL_H - 32);

  const kbLow =
    Math.floor(
      (Math.min(
        lo + transpose,
        ...(state.chordLit.length ? state.chordLit : [lo + transpose])
      ) -
        1) /
        12
    ) * 12;

  const bar = Math.floor(state.beat / beatsPerBar);
  const current = state.noteIndex >= 0 ? melody.notes[state.noteIndex] : null;
  const suggestions = current
    ? harmonizeNote(current.midi + transpose, song.key, transpose)
    : [];

  // Keep the playhead in view during playback
  const scrollKey = lite ? bar : Math.floor(state.beat * 2);
  useEffect(() => {
    if (!state.playing || !rollRef.current) return;
    const rollW = rollRef.current.clientWidth || 360;
    const x = lite
      ? bar * beatsPerBar * BEAT_W - BEAT_W
      : state.beat * BEAT_W - rollW / 3;
    rollRef.current.scrollTo({ left: Math.max(0, x), behavior: 'auto' });
  }, [scrollKey, state.playing, lite, bar, beatsPerBar]);

  const bars = Math.ceil(melody.beats / beatsPerBar);
  const headBeat = lite && current ? current.beat : state.beat;

  const auditionSuggestedChord = (chordSym: string) => {
    Synth.release(SUGGESTION_GROUP);
    const notes = voiceChord(chordSym, { inversion: 'auto', octave: 0, bass: true });
    Synth.playNotes(notes, chordSpec || LITE_CHORD_SPEC, SUGGESTION_GROUP);
    setTimeout(() => Synth.release(SUGGESTION_GROUP), 550);
  };

  return (
    <div className="flex flex-1 flex-col bg-[#0b0d12]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#1d2331] px-4 py-3">
        <button
          type="button"
          onClick={() => {
            player.pause();
            onBack();
          }}
          className="flex h-11 w-10 items-center justify-center rounded-xl text-3xl text-[#f3f5f8] hover:bg-[#1b212e]"
        >
          ‹
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-[#f3f5f8]">
            Melody · {song.title}
          </h1>
          <p className="mt-0.5 text-xs text-[#8d96a8] tabular-nums">
            {melody.notes.length} notes · {bars} bars · {song.time}
          </p>
        </div>

        <div className="min-w-[64px] text-right font-mono text-2xl font-extrabold text-[#ffae52]">
          {state.chord || '—'}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-3">
        {/* Dual-Lit MiniKeyboard */}
        <MiniKeyboard
          low={kbLow}
          octaves={3}
          lit={state.melodyLit}
          litStrings={backing ? state.chordLit : []}
        />

        {/* Now Playing Note & Lyric Syllable Readout */}
        <div className="mt-3 flex items-baseline gap-4 px-1">
          <span className="min-w-[64px] font-mono text-2xl font-extrabold text-[#ff8a1f] tabular-nums">
            {current ? noteName(current.midi + transpose) : 'rest'}
          </span>
          <span className="flex-1 truncate text-xl font-semibold text-[#f3f5f8]">
            {current?.syllable ?? ''}
          </span>
          <span className="font-mono text-xs text-[#8d96a8] tabular-nums">
            bar {bar + 1} / {bars}
          </span>
        </div>

        {/* Interactive Horizontal Piano-Roll Lane */}
        <div
          ref={rollRef}
          className="mt-2.5 overflow-x-auto rounded-xl border border-[#1d2331] bg-[#12161f]"
        >
          <div
            style={{
              width: melody.beats * BEAT_W + 240,
              height: ROLL_H + 44,
            }}
            className="relative select-none"
          >
            {loopBar !== null && (
              <div
                style={{
                  left: loopBar * beatsPerBar * BEAT_W,
                  width: beatsPerBar * BEAT_W,
                }}
                className="pointer-events-none absolute inset-y-0 bg-[#6ad3ff]/12"
              />
            )}

            {/* Bar Columns */}
            {Array.from({ length: bars + 1 }, (_, b) => (
              <button
                key={`bar${b}`}
                type="button"
                onClick={() => player.seek(b * beatsPerBar)}
                onDoubleClick={() =>
                  setLoopBar((l) => (l === b ? null : b))
                }
                onContextMenu={(e) => {
                  e.preventDefault();
                  setLoopBar((l) => (l === b ? null : b));
                }}
                style={{
                  left: b * beatsPerBar * BEAT_W,
                  width: beatsPerBar * BEAT_W,
                }}
                className="absolute inset-y-0 border-l border-[#283042] text-left focus:outline-none hover:bg-white/[0.02]"
                title="Click to jump to bar · Double-click or right-click to loop bar"
              >
                <span className="ml-1.5 mt-1 inline-block font-mono text-[10px] text-[#8d96a8]">
                  {b + 1}
                </span>
              </button>
            ))}

            {/* Harmony Chord Markers */}
            {melody.harmony.map((h, i) => (
              <span
                key={`h${i}`}
                style={{ left: h.beat * BEAT_W + 18 }}
                className="pointer-events-none absolute top-1 font-mono text-xs font-bold text-[#ffae52]"
              >
                {h.chord}
              </span>
            ))}

            {/* MIDI Note Bars */}
            {melody.notes.map((n, i) => {
              const isCurrent = state.noteIndex === i;
              return (
                <button
                  key={`n${i}`}
                  type="button"
                  onClick={() => {
                    player.audition(i);
                    player.seek(n.beat);
                  }}
                  style={{
                    left: n.beat * BEAT_W + 1,
                    top: 20 + yOf(n.midi) - 5,
                    width: Math.max(8, n.dur * BEAT_W - 2),
                  }}
                  className={`absolute h-3 rounded-xs transition-colors focus:outline-none ${
                    isCurrent
                      ? 'z-10 bg-[#ff8a1f] ring-2 ring-[#ffae52]/60'
                      : 'bg-[#7c6b55] hover:bg-[#ffae52]'
                  }`}
                  title={`${noteName(n.midi + transpose)} ${n.syllable ?? ''}`}
                />
              );
            })}

            {/* Lyric Syllables Underneath */}
            {melody.notes.map((n, i) =>
              n.syllable ? (
                <span
                  key={`s${i}`}
                  style={{
                    left: n.beat * BEAT_W,
                    top: ROLL_H + 18,
                    width: Math.max(BEAT_W, n.dur * BEAT_W) + 14,
                  }}
                  className={`pointer-events-none absolute truncate text-[11px] ${
                    state.noteIndex === i
                      ? 'font-bold text-[#f3f5f8]'
                      : 'text-[#8d96a8]'
                  }`}
                >
                  {n.syllable}
                </span>
              ) : null
            )}

            {/* Playhead */}
            <div
              style={{ left: headBeat * BEAT_W }}
              className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-[#6ad3ff]"
            />
          </div>
        </div>

        <p className="mt-1.5 text-center text-[11px] text-[#8d96a8]">
          Tap a note to hear it · tap a bar number to jump · double-click a bar
          (or tap ⟲) to loop it
        </p>

        {/* Transport Bar */}
        <div className="my-4 flex items-center justify-center gap-3.5">
          <button
            type="button"
            onClick={() => player.seek(0)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1b212e] text-base font-bold text-[#f3f5f8] hover:bg-[#252d3e]"
            aria-label="Restart from bar 1"
          >
            |‹
          </button>
          <button
            type="button"
            onClick={() =>
              player.seek(Math.max(0, (bar - 1) * beatsPerBar))
            }
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1b212e] text-base font-bold text-[#f3f5f8] hover:bg-[#252d3e]"
            aria-label="Previous bar"
          >
            ‹‹
          </button>
          <button
            type="button"
            onClick={player.toggle}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ff8a1f] text-xl font-extrabold text-[#0b0d12] shadow-lg transition-transform active:scale-95"
            aria-label={state.playing ? 'Pause melody' : 'Play melody'}
          >
            {state.playing ? '❚❚' : '▶'}
          </button>
          <button
            type="button"
            onClick={() => player.seek((bar + 1) * beatsPerBar)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1b212e] text-base font-bold text-[#f3f5f8] hover:bg-[#252d3e]"
            aria-label="Next bar"
          >
            ››
          </button>
          <button
            type="button"
            onClick={() => setLoopBar((l) => (l === null ? bar : null))}
            className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold transition-colors ${
              loopBar !== null
                ? 'bg-[#6ad3ff]/25 text-[#6ad3ff] border border-[#6ad3ff]'
                : 'bg-[#1b212e] text-[#f3f5f8] hover:bg-[#252d3e]'
            }`}
            aria-label="Loop current bar"
          >
            ⟲
          </button>
        </div>

        {/* Controls Grid */}
        <div className="grid grid-cols-1 gap-4 pb-10 md:grid-cols-2">
          {/* Tempo */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8d96a8]">
              Tempo
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onBpm(Math.max(30, bpm - 5))}
                className="min-h-[42px] min-w-[42px] rounded-full bg-[#1b212e] px-3 text-sm font-semibold text-[#f3f5f8] hover:bg-[#252d3e]"
              >
                −
              </button>
              <span className="min-w-[48px] text-center font-mono text-lg font-bold text-[#f3f5f8] tabular-nums">
                {bpm}
              </span>
              <button
                type="button"
                onClick={() => onBpm(Math.min(240, bpm + 5))}
                className="min-h-[42px] min-w-[42px] rounded-full bg-[#1b212e] px-3 text-sm font-semibold text-[#f3f5f8] hover:bg-[#252d3e]"
              >
                +
              </button>
              <button
                type="button"
                onClick={() =>
                  onBpm(Math.max(30, Math.round(song.tempo * 0.75)))
                }
                className="min-h-[42px] min-w-[42px] rounded-full bg-[#1b212e] px-3.5 text-sm font-semibold text-[#f3f5f8] hover:bg-[#252d3e]"
              >
                ¾
              </button>
              <button
                type="button"
                onClick={() => onBpm(song.tempo)}
                className="min-h-[42px] min-w-[42px] rounded-full bg-[#1b212e] px-3.5 text-sm font-semibold text-[#f3f5f8] hover:bg-[#252d3e]"
              >
                1×
              </button>
            </div>
          </div>

          {/* Melody Voice */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8d96a8]">
              Melody voice
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {voices.map((v, i) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVoiceIdx(i)}
                  className={`min-h-[42px] rounded-full px-4 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    i === voiceIdx
                      ? 'bg-[#ff8a1f] text-[#0b0d12]'
                      : 'bg-[#1b212e] text-[#f3f5f8] hover:bg-[#252d3e]'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Performance & Chord Backing */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8d96a8]">
              Chord backing & performance
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setBacking((b) => !b)}
                className={`min-h-[42px] rounded-full px-4 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  backing
                    ? 'bg-[#ff8a1f] text-[#0b0d12]'
                    : 'bg-[#1b212e] text-[#f3f5f8]'
                }`}
              >
                {backing
                  ? `Backing: On · ${
                      lite ? 'light e-piano' : keys?.name ?? 'e-piano'
                    }`
                  : 'Backing: Off'}
              </button>

              <button
                type="button"
                onClick={() => setLite(!lite)}
                className={`min-h-[42px] rounded-full px-4 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  lite
                    ? 'bg-[#ff8a1f] text-[#0b0d12]'
                    : 'bg-[#1b212e] text-[#f3f5f8]'
                }`}
              >
                {lite ? 'Lite mode · on' : 'Lite mode · off'}
              </button>
            </div>
          </div>

          {/* Real-Time Harmonizer Suggestions */}
          {suggestions.length > 0 && current && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#8d96a8]">
                Chords that fit {noteName(current.midi + transpose)} (tap to hear)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {suggestions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => auditionSuggestedChord(c)}
                    className={`min-h-[42px] min-w-[44px] rounded-full bg-[#1b212e] px-4 font-mono text-sm font-semibold text-[#f3f5f8] transition-colors hover:bg-[#252d3e] whitespace-nowrap shrink-0 ${
                      c === state.chord ? 'border-2 border-[#ffae52]' : ''
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
