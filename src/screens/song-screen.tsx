import React, { useEffect, useRef, useState } from 'react';
import { type Song, songToText, transposeChord } from '../lib/chordpro';
import type { Instrument } from '../lib/instruments';
import { voiceChord } from '../lib/music-theory';
import { voiceForStrings } from '../lib/string-voicing';
import { Synth } from '../modules/songbook-overlay';

export type SongScreenProps = {
  song: Song;
  transpose: number;
  bpm: number;
  keys?: Instrument;
  strings?: Instrument;
  onTranspose: (steps: number) => void;
  onBpm: (bpm: number) => void;
  onBack: () => void;
  onFloat: () => void;
  onEdit: () => void;
  /** Opens the chord & drum pads for this song. */
  onPads?: () => void;
  /** Opens melody playback (when the song has an imported/generated melody). */
  onMelody?: () => void;
  /** Generates a playable lead melody for a song that doesn't have one yet. */
  onGenerateMelody?: () => void;
  generatingMelody?: boolean;
  /** Gig mode: position in the setlist being played, with Prev / Next handlers. */
  setlist?: {
    name: string;
    index: number;
    total: number;
    onPrev?: () => void;
    onNext?: () => void;
  };
};

const SHEET_CHORD_GROUP = 770001;

/**
 * Full-screen song view: chords over lyrics, BPM-linked auto-scroll (tap the sheet
 * to play/pause), tap any chord in the sheet to audition its voicing, transpose, tap tempo,
 * text size, copy, and "Float over apps".
 */
export function SongScreen({
  song,
  transpose,
  bpm,
  keys,
  strings,
  onTranspose,
  onBpm,
  onBack,
  onFloat,
  onEdit,
  onPads,
  onMelody,
  onGenerateMelody,
  generatingMelody,
  setlist,
}: SongScreenProps) {
  const [playing, setPlaying] = useState(false);
  const [size, setSize] = useState(18);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taps = useRef<number[]>([]);

  useEffect(() => {
    setPlaying(false);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [song.id]);

  useEffect(() => {
    if (!playing) return undefined;
    const rowPx = size * 1.4 * 2;
    const pxPerMs = ((bpm / 60000) / 4) * rowPx;
    let lastT = performance.now();

    const id = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const now = performance.now();
      const dt = now - lastT;
      lastT = now;

      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      const nextY = Math.min(el.scrollTop + dt * pxPerMs, maxScroll);
      el.scrollTop = nextY;
      if (nextY >= maxScroll - 1) {
        setPlaying(false);
      }
    }, 50);

    return () => clearInterval(id);
  }, [playing, bpm, size]);

  const tap = () => {
    const now = Date.now();
    const list = [...taps.current.filter((t) => now - t < 2500), now].slice(-6);
    taps.current = list;
    if (list.length >= 2) {
      const avg = (list[list.length - 1] - list[0]) / (list.length - 1);
      onBpm(Math.max(30, Math.min(300, Math.round(60000 / avg))));
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(songToText(song, transpose));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  const auditionChordInline = (chordSymbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    Synth.release(SHEET_CHORD_GROUP);
    const kNotes = voiceChord(chordSymbol, { inversion: 'auto', octave: 0, bass: true });
    if (keys) Synth.playNotes(kNotes, keys.spec, SHEET_CHORD_GROUP);
    if (strings) {
      const sNotes = voiceForStrings(chordSymbol, strings, 0);
      Synth.playNotes(sNotes, strings.spec, SHEET_CHORD_GROUP);
    }
    setTimeout(() => Synth.release(SHEET_CHORD_GROUP), 650);
  };

  const key = song.key ? transposeChord(song.key, transpose) : undefined;

  return (
    <div className="relative flex flex-1 flex-col bg-[#0b0d12]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[#1d2331] px-4 py-2.5">
        <button
          type="button"
          aria-label="Back to library"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-3xl text-[#f3f5f8] hover:bg-[#1b212e]"
        >
          ‹
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold text-[#f3f5f8]">
            {song.title}
          </h1>
          <p className="truncate text-xs text-[#8d96a8] tabular-nums">
            {[song.artist, key && `Key ${key}`, `${bpm} BPM`, song.time]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        {onMelody ? (
          <button
            type="button"
            aria-label="Play the melody"
            onClick={onMelody}
            className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#283042] bg-[#1b212e] px-3.5 text-sm font-bold text-[#6ad3ff] hover:border-[#6ad3ff] whitespace-nowrap shrink-0"
          >
            <span>♪</span>
            <span className="hidden sm:inline">Melody</span>
          </button>
        ) : (
          onGenerateMelody && (
            <button
              type="button"
              disabled={generatingMelody}
              onClick={onGenerateMelody}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#283042] bg-[#1b212e] px-3.5 text-xs font-bold text-[#6ad3ff] hover:border-[#6ad3ff] disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {generatingMelody ? '◌ Transcribing…' : '♪ Extract Melody'}
            </button>
          )
        )}

        {onPads && (
          <button
            type="button"
            aria-label="Chord and drum pads"
            onClick={onPads}
            className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#283042] bg-[#1b212e] px-3.5 text-sm font-bold text-[#ffae52] hover:border-[#ff8a1f] whitespace-nowrap shrink-0"
          >
            <span>♫</span>
            <span className="hidden sm:inline">Pads</span>
          </button>
        )}

        <button
          type="button"
          aria-label="Edit song"
          onClick={onEdit}
          className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#283042] bg-[#1b212e] px-3.5 text-sm font-bold text-[#f3f5f8] hover:border-[#ff8a1f] whitespace-nowrap shrink-0"
        >
          <span>✎</span>
          <span className="hidden sm:inline">Edit</span>
        </button>
      </div>

      {/* Horizontal Performance Toolbar */}
      <div className="flex items-center gap-2.5 overflow-x-auto border-b border-[#1d2331] px-4 py-2">
        <Btn
          label={playing ? '❚❚ Scroll' : '▶ Scroll'}
          on={playing}
          onPress={() => setPlaying((p) => !p)}
          wide
        />

        <div className="flex items-center gap-1 rounded-xl bg-[#10131a] p-1 border border-[#1d2331]">
          <Btn label="−" onPress={() => onBpm(Math.max(30, bpm - 2))} />
          <span className="min-w-[44px] text-center font-mono text-sm font-extrabold text-[#ffae52] tabular-nums">
            {bpm}
          </span>
          <Btn label="+" onPress={() => onBpm(Math.min(300, bpm + 2))} />
          <Btn label="TAP" onPress={tap} />
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-[#10131a] p-1 border border-[#1d2331]">
          <Btn label="♭" onPress={() => onTranspose(transpose - 1)} />
          <span className="min-w-[36px] text-center font-mono text-sm font-extrabold text-[#ffae52] tabular-nums">
            {transpose > 0 ? `+${transpose}` : transpose}
          </span>
          <Btn label="♯" onPress={() => onTranspose(transpose + 1)} />
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-[#10131a] p-1 border border-[#1d2331]">
          <Btn label="A−" onPress={() => setSize((s) => Math.max(13, s - 2))} />
          <Btn label="A+" onPress={() => setSize((s) => Math.min(34, s + 2))} />
        </div>

        <Btn label={copied ? '✓ Copied' : '⧉ Copy'} onPress={copy} />
      </div>

      {/* Setlist / Gig Mode Bar */}
      {setlist && (
        <div className="flex items-center justify-between gap-3 border-b border-[#1d2331] bg-[#ff8a1f]/8 px-4 py-2">
          <button
            type="button"
            disabled={!setlist.onPrev}
            onClick={setlist.onPrev}
            className="min-h-[40px] min-w-[76px] rounded-xl border border-[#283042] bg-[#1b212e] px-3 text-sm font-extrabold text-[#f3f5f8] disabled:opacity-35 whitespace-nowrap shrink-0"
          >
            ‹ Prev
          </button>
          <span className="truncate text-center text-sm font-bold text-[#ffae52] tabular-nums">
            {setlist.name} · {setlist.index + 1}/{setlist.total}
          </span>
          <button
            type="button"
            disabled={!setlist.onNext}
            onClick={setlist.onNext}
            className="min-h-[40px] min-w-[76px] rounded-xl border border-[#283042] bg-[#1b212e] px-3 text-sm font-extrabold text-[#f3f5f8] disabled:opacity-35 whitespace-nowrap shrink-0"
          >
            Next ›
          </button>
        </div>
      )}

      {/* Main ChordPro Sheet */}
      <div
        ref={scrollRef}
        onClick={() => setPlaying((p) => !p)}
        className="flex-1 overflow-y-auto px-5 py-6 pb-48 cursor-pointer select-none"
      >
        <div className="mx-auto max-w-3xl space-y-5">
          {song.sections.map((section, si) => (
            <div
              key={si}
              className={`rounded-xl border px-4 py-3.5 ${
                section.kind === 'chorus'
                  ? 'border-[#ff8a1f]/35 bg-[#ff8a1f]/6'
                  : section.kind === 'bridge'
                  ? 'border-[#6ad3ff]/35 bg-[#6ad3ff]/5'
                  : 'border-[#1d2331] bg-[#12161f]/40'
              }`}
            >
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-[#8d96a8]">
                {section.label}
              </div>

              {section.lines.map((line, li) => {
                if (line.type === 'empty') {
                  return <div key={li} style={{ height: size * 0.5 }} />;
                }
                if (line.type === 'comment') {
                  return (
                    <div
                      key={li}
                      style={{ fontSize: size * 0.8 }}
                      className="my-1.5 italic text-[#6ad3ff]"
                    >
                      {line.text}
                    </div>
                  );
                }
                return (
                  <div key={li} className="mb-2 flex flex-wrap items-end">
                    {line.segments.map((seg, gi) => {
                      const chordName = seg.chord
                        ? transposeChord(seg.chord, transpose)
                        : '';
                      return (
                        <div key={gi} className="mr-1.5">
                          {chordName ? (
                            <button
                              type="button"
                              onClick={(e) => auditionChordInline(chordName, e)}
                              style={{ fontSize: size * 0.88 }}
                              title={`Tap to hear ${chordName}`}
                              className="block rounded px-1 -mx-1 font-mono font-extrabold text-[#ffae52] hover:bg-[#ff8a1f]/20 focus:outline-none"
                            >
                              {chordName}{' '}
                            </button>
                          ) : (
                            <div
                              style={{ fontSize: size * 0.88 }}
                              className="font-mono font-extrabold"
                            >
                              &nbsp;
                            </div>
                          )}
                          <div
                            style={{ fontSize: size }}
                            className="leading-snug text-[#f3f5f8] whitespace-pre"
                          >
                            {seg.lyric || ' '}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}

          <div className="pt-4 text-center text-xs text-[#8d96a8]">
            — end · tap sheet to auto-scroll · tap any chord to hear voicing —
          </div>

          {setlist?.onNext && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setlist.onNext?.();
                }}
                className="min-h-[52px] rounded-full border border-[#ff8a1f] bg-[#1b212e] px-7 text-base font-extrabold text-[#ff8a1f] hover:bg-[#ff8a1f] hover:text-[#111] whitespace-nowrap shrink-0"
              >
                Next song ›
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        type="button"
        aria-label="Float this song over other apps"
        onClick={onFloat}
        className="fixed right-5 bottom-6 z-20 flex min-h-[52px] items-center gap-2 rounded-full bg-[#ff8a1f] px-5 text-base font-extrabold text-[#111] shadow-xl transition-transform hover:scale-105 active:scale-95 whitespace-nowrap shrink-0"
      >
        ⧉ Float over apps
      </button>
    </div>
  );
}

function Btn({
  label,
  onPress,
  on,
  wide,
}: {
  label: string;
  onPress: () => void;
  on?: boolean;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={`min-h-[42px] rounded-xl border px-3 text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
        wide ? 'min-w-[88px]' : 'min-w-[42px]'
      } ${
        on
          ? 'border-[#ff8a1f] bg-[#ff8a1f] text-[#111]'
          : 'border-[#283042] bg-[#1b212e] text-[#f3f5f8] hover:border-[#ff8a1f]/60'
      }`}
    >
      {label}
    </button>
  );
}
