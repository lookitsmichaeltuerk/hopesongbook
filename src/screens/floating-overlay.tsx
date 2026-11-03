import React, { useEffect, useMemo, useRef, useState } from 'react';
import { type Song, transposeChord } from '../lib/chordpro';
import type { Instrument } from '../lib/instruments';
import { GROOVES } from '../lib/instruments';
import type { PadSettings } from '../lib/pad-settings';
import { songChords } from '../lib/song-chords';
import { keyChords, normalizeKeyLabel, parseKey, voiceChord } from '../lib/music-theory';
import { voiceForStrings } from '../lib/string-voicing';
import { voiceBass } from '../lib/bass-voicing';
import { useDrumLoop } from '../lib/drum-loop';
import { Synth } from '../modules/songbook-overlay';

export type FloatingOverlayProps = {
  song: Song;
  transpose: number;
  bpm: number;
  settings: PadSettings;
  keys?: Instrument;
  strings?: Instrument;
  bass?: Instrument;
  onTranspose: (next: number) => void;
  onBpm: (next: number) => void;
  onClose: () => void;
  onExpandToApp: () => void;
};

const bassOf = (chord: string) => {
  const m = chord.match(/\/([A-G][#b]?)$/) ?? chord.match(/^([A-G][#b]?)/);
  return m ? m[1] : chord;
};

/**
 * Interactive Draggable Floating Songbook Window (`SYSTEM_ALERT_WINDOW` overlay experience).
 * Includes auto-scrolling lyrics, playable chord & bass pads, drum groove toggle,
 * opacity control, collapse-to-pill mode, and an optional simulated DAW / practice backdrop.
 */
export function FloatingOverlay({
  song,
  transpose,
  bpm,
  settings,
  keys,
  strings,
  bass,
  onTranspose,
  onBpm,
  onClose,
  onExpandToApp,
}: FloatingOverlayProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showPads, setShowPads] = useState(true);
  const [scrolling, setScrolling] = useState(false);
  const [opacity, setOpacity] = useState(0.95);
  const [backdropMode, setBackdropMode] = useState<'none' | 'daw'>('none');
  const [pos, setPos] = useState({ x: 24, y: 68 });
  const [activeChord, setActiveChord] = useState<string>('');

  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null
  );
  const sheetRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef(300000);
  const bassGroupRef = useRef(400000);
  const prevVoicingRef = useRef<number[] | undefined>(undefined);

  const songKey = song.key ? transposeChord(song.key, transpose) : 'C';
  const parsedKey = parseKey(normalizeKeyLabel(songKey));
  const chordsInSong = useMemo(
    () => songChords(song).map((c) => transposeChord(c, transpose)),
    [song, transpose]
  );
  const diatonicPalette = useMemo(
    () => keyChords(parsedKey, false).diatonic.map((c) => c.symbol),
    [parsedKey.label]
  );
  const padChords = useMemo(() => {
    const merged = [...chordsInSong];
    for (const d of diatonicPalette) {
      if (!merged.includes(d)) merged.push(d);
    }
    return merged.slice(0, 8);
  }, [chordsInSong, diatonicPalette]);

  const groove = GROOVES.find((g) => g.id === settings.grooveId) ?? GROOVES[0];
  const drumLoop = useDrumLoop(groove, bpm);

  // Auto-scroll effect inside floating lyric pane
  useEffect(() => {
    if (!scrolling || collapsed) return undefined;
    const el = sheetRef.current;
    if (!el) return undefined;
    const pxPerTick = ((bpm / 60) / 4) * 2.2;
    const id = setInterval(() => {
      if (!sheetRef.current) return;
      sheetRef.current.scrollTop += pxPerTick;
      if (
        sheetRef.current.scrollTop + sheetRef.current.clientHeight >=
        sheetRef.current.scrollHeight - 2
      ) {
        setScrolling(false);
      }
    }, 50);
    return () => clearInterval(id);
  }, [scrolling, bpm, collapsed]);

  const triggerChord = (chord: string) => {
    Synth.release(groupRef.current);
    groupRef.current += 1;
    const g = groupRef.current;
    const withBass = settings.bassWithChords && !!bass;
    const keyNotes = keys
      ? voiceChord(
          chord,
          { inversion: 'auto', style: 'close', octave: settings.octave, bass: !withBass },
          prevVoicingRef.current
        )
      : [];
    const strNotes = strings ? voiceForStrings(chord, strings, settings.octave) : [];
    const lhNotes =
      withBass && bass ? voiceBass(chord, settings.bassStyle, settings.octave, bass.low) : [];

    if (keys && keyNotes.length) {
      Synth.playNotes(keyNotes, keys.spec, g);
      prevVoicingRef.current = keyNotes;
    }
    if (strings && strNotes.length) {
      Synth.playNotes(strNotes, strings.spec, g);
    }
    if (bass && lhNotes.length) {
      Synth.playNotes(lhNotes, bass.spec, g);
    }
    setActiveChord(chord);
  };

  const releaseChord = () => {
    Synth.release(groupRef.current);
  };

  const triggerBass = (chord: string) => {
    if (!bass) return;
    Synth.release(bassGroupRef.current);
    bassGroupRef.current += 1;
    const notes = voiceBass(chord, settings.bassStyle, settings.octave, bass.low);
    Synth.playNotes(notes, bass.spec, bassGroupRef.current);
    setActiveChord(`${bassOf(chord)} bass`);
  };

  const releaseBass = () => {
    Synth.release(bassGroupRef.current);
  };

  const onDragStart = (e: React.PointerEvent) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onDragMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({
      x: Math.max(8, Math.min(window.innerWidth - 280, dragRef.current.origX + dx)),
      y: Math.max(8, Math.min(window.innerHeight - 100, dragRef.current.origY + dy)),
    });
  };

  const onDragEnd = () => {
    dragRef.current = null;
  };

  if (collapsed) {
    return (
      <div
        style={{ left: pos.x, top: pos.y }}
        className="fixed z-50 flex items-center gap-2 rounded-full border border-[#ff8a1f] bg-[#12161f]/95 px-3.5 py-2 shadow-2xl backdrop-blur-md"
      >
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          className="cursor-move select-none text-sm font-extrabold text-[#ff8a1f]"
          title="Drag floating bubble"
        >
          ⧉ {song.title}
        </div>
        {activeChord && (
          <span className="font-mono text-xs font-bold text-[#ffae52]">{activeChord}</span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded-full bg-[#1b212e] px-2.5 py-1 text-xs font-bold text-[#f3f5f8] hover:bg-[#283042] whitespace-nowrap shrink-0"
        >
          Expand
        </button>
        <button
          type="button"
          onClick={() => {
            Synth.stopAll();
            drumLoop.stop();
            onClose();
          }}
          className="rounded-full px-2 py-1 text-xs font-bold text-[#ff5c7a] hover:bg-[#1b212e]"
          aria-label="Close floating window"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Optional Simulated External DAW / Backing App Backdrop so users can test floating over another app */}
      {backdropMode === 'daw' && (
        <div className="fixed inset-0 z-30 flex flex-col bg-[#080a0e] p-6 text-[#8d96a8]">
          <div className="mb-4 flex items-center justify-between border-b border-[#1d2331] pb-3">
            <div className="flex items-center gap-3">
              <span className="rounded bg-[#1b212e] px-2.5 py-1 font-mono text-xs font-bold text-[#6ad3ff]">
                EXTERNAL APP SIMULATOR · FL STUDIO MOBILE / YOUTUBE BACKING TRACK
              </span>
              <span className="text-xs text-[#8d96a8]">
                Hope Songbook floats on top of this background app so you can play chords & read lyrics
              </span>
            </div>
            <button
              type="button"
              onClick={() => setBackdropMode('none')}
              className="min-h-[38px] rounded-lg border border-[#283042] bg-[#12161f] px-3 text-xs font-bold text-[#f3f5f8] hover:border-[#ff8a1f] whitespace-nowrap shrink-0"
            >
              Exit Background Simulator
            </button>
          </div>
          <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
            {['Track 1 · Reference Vocal Stem', 'Track 2 · Stereo Room Mic', 'Track 3 · Click & Cues'].map(
              (t, idx) => (
                <div
                  key={t}
                  className="flex flex-col justify-between rounded-xl border border-[#1d2331] bg-[#0e121a] p-4"
                >
                  <div className="text-xs font-bold text-[#f3f5f8]">{t}</div>
                  <div className="my-6 flex h-24 items-center gap-1">
                    {Array.from({ length: 28 }, (_, i) => (
                      <div
                        key={i}
                        style={{
                          height: `${20 + ((i * 17 + idx * 11) % 75)}%`,
                        }}
                        className="flex-1 rounded-xs bg-[#283042]"
                      />
                    ))}
                  </div>
                  <div className="font-mono text-[11px] text-[#8d96a8]">
                    Key {parsedKey.label} · {bpm} BPM
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Draggable Floating Overlay Window */}
      <div
        style={{
          left: pos.x,
          top: pos.y,
          opacity,
        }}
        className="fixed z-40 flex w-[360px] max-w-[94vw] flex-col overflow-hidden rounded-2xl border border-[#ff8a1f]/70 bg-[#12161f] shadow-2xl sm:w-[410px]"
      >
        {/* Drag Handle Header */}
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          className="flex cursor-move select-none items-center justify-between gap-2 border-b border-[#1d2331] bg-[#1b212e] px-3.5 py-2.5"
        >
          <div className="flex items-center gap-2 truncate">
            <span className="text-base font-extrabold text-[#ff8a1f]">⧉</span>
            <div className="truncate">
              <div className="truncate text-sm font-extrabold text-[#f3f5f8]">
                {song.title}
              </div>
              <div className="text-[11px] text-[#8d96a8] tabular-nums">
                Key {parsedKey.label} · {bpm} BPM {activeChord ? `· Playing ${activeChord}` : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setBackdropMode((m) => (m === 'daw' ? 'none' : 'daw'))}
              title="Simulate floating over FL Studio Mobile / YouTube"
              className={`min-h-[32px] rounded-lg px-2 text-[11px] font-bold whitespace-nowrap shrink-0 ${
                backdropMode === 'daw'
                  ? 'bg-[#6ad3ff] text-black'
                  : 'bg-[#12161f] text-[#6ad3ff] border border-[#283042]'
              }`}
            >
              {backdropMode === 'daw' ? 'DAW Bg: On' : 'Test Over DAW'}
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              title="Minimize to floating pill"
              className="min-h-[32px] min-w-[32px] rounded-lg bg-[#12161f] text-xs font-bold text-[#f3f5f8] hover:bg-[#283042]"
            >
              —
            </button>
            <button
              type="button"
              onClick={onExpandToApp}
              title="Return to full screen"
              className="min-h-[32px] min-w-[32px] rounded-lg bg-[#12161f] text-xs font-bold text-[#ffae52] hover:bg-[#283042]"
            >
              ⤢
            </button>
            <button
              type="button"
              onClick={() => {
                Synth.stopAll();
                drumLoop.stop();
                onClose();
              }}
              title="Close overlay"
              className="min-h-[32px] min-w-[32px] rounded-lg bg-[#12161f] text-xs font-bold text-[#ff5c7a] hover:bg-[#283042]"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Mini Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-[#1d2331] bg-[#0b0d12] px-3 py-1.5 text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setScrolling((s) => !s)}
              className={`min-h-[32px] rounded-lg px-2.5 font-bold whitespace-nowrap shrink-0 ${
                scrolling ? 'bg-[#ff8a1f] text-black' : 'bg-[#1b212e] text-[#f3f5f8]'
              }`}
            >
              {scrolling ? '❚❚ Scroll' : '▶ Scroll'}
            </button>
            <button
              type="button"
              onClick={() => onTranspose(transpose - 1)}
              className="min-h-[32px] min-w-[30px] rounded-lg bg-[#1b212e] font-bold text-[#f3f5f8]"
            >
              ♭
            </button>
            <span className="min-w-[24px] text-center font-mono font-bold text-[#ffae52] tabular-nums">
              {transpose > 0 ? `+${transpose}` : transpose}
            </span>
            <button
              type="button"
              onClick={() => onTranspose(transpose + 1)}
              className="min-h-[32px] min-w-[30px] rounded-lg bg-[#1b212e] font-bold text-[#f3f5f8]"
            >
              ♯
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={drumLoop.toggle}
              className={`min-h-[32px] rounded-lg px-2.5 font-bold whitespace-nowrap shrink-0 ${
                drumLoop.playing ? 'bg-[#ff8a1f] text-black' : 'bg-[#1b212e] text-[#f3f5f8]'
              }`}
            >
              {drumLoop.playing ? '■ Drums' : '🥁 Loop'}
            </button>
            <button
              type="button"
              onClick={() => setShowPads((p) => !p)}
              className={`min-h-[32px] rounded-lg px-2.5 font-bold whitespace-nowrap shrink-0 ${
                showPads ? 'bg-[#ff8a1f]/20 text-[#ffae52] border border-[#ff8a1f]/50' : 'bg-[#1b212e] text-[#8d96a8]'
              }`}
            >
              🎹 Pads
            </button>
            <input
              type="range"
              min={0.45}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-12 accent-[#ff8a1f]"
              title="Overlay opacity"
            />
          </div>
        </div>

        {/* Scrollable Compact ChordPro Lyrics */}
        <div
          ref={sheetRef}
          onClick={() => setScrolling((s) => !s)}
          className="max-h-[210px] overflow-y-auto px-3.5 py-2.5 space-y-2.5 cursor-pointer"
        >
          {song.sections.map((sec, si) => (
            <div key={si} className="space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#8d96a8]">
                {sec.label}
              </div>
              {sec.lines.map((line, li) => {
                if (line.type === 'empty') return <div key={li} className="h-2" />;
                if (line.type === 'comment') {
                  return (
                    <div key={li} className="text-xs italic text-[#6ad3ff]">
                      {line.text}
                    </div>
                  );
                }
                return (
                  <div key={li} className="flex flex-wrap leading-tight">
                    {line.segments.map((seg, gi) => {
                      const c = seg.chord ? transposeChord(seg.chord, transpose) : '';
                      return (
                        <div key={gi} className="mr-1">
                          <div className="font-mono text-xs font-extrabold text-[#ffae52]">
                            {c || '\u00A0'}
                          </div>
                          <div className="text-sm text-[#f3f5f8]">
                            {seg.lyric || '\u00A0'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Compact Playable Chord & Left-Hand Bass Pads inside the Floating Window */}
        {showPads && (
          <div className="border-t border-[#1d2331] bg-[#0b0d12] p-2.5 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold text-[#8d96a8]">
              <span>
                CHORD PADS · {keys?.name ?? 'Keys'} + {strings?.name ?? 'Strings'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onBpm(Math.max(40, bpm - 4))}
                  className="px-1.5 py-0.5 rounded bg-[#1b212e] text-[#f3f5f8]"
                >
                  −
                </button>
                <span className="tabular-nums text-[#ffae52]">{bpm} BPM</span>
                <button
                  type="button"
                  onClick={() => onBpm(Math.min(240, bpm + 4))}
                  className="px-1.5 py-0.5 rounded bg-[#1b212e] text-[#f3f5f8]"
                >
                  +
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {padChords.map((c) => (
                <button
                  key={c}
                  type="button"
                  onPointerDown={() => triggerChord(c)}
                  onPointerUp={releaseChord}
                  onPointerLeave={releaseChord}
                  className="min-h-[44px] rounded-xl border border-[#283042] bg-[#1b212e] font-mono text-sm font-extrabold text-[#ffae52] transition-transform active:scale-95 active:bg-[#3c2c1a]"
                >
                  {c}
                </button>
              ))}
            </div>
            {bass && (
              <div className="flex gap-1.5 overflow-x-auto pt-0.5">
                {padChords.slice(0, 6).map((c) => (
                  <button
                    key={`fb-${c}`}
                    type="button"
                    onPointerDown={() => triggerBass(c)}
                    onPointerUp={releaseBass}
                    onPointerLeave={releaseBass}
                    className="min-h-[36px] flex-1 rounded-lg border border-[#24405e] bg-[#14202e] px-2 font-mono text-xs font-black text-[#5aa8ff] active:scale-95"
                  >
                    {bassOf(c)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
