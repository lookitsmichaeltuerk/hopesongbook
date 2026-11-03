import { useEffect, useRef, useState } from 'react';
import { transposeChord, type SongMelody } from './chordpro';
import type { SynthSpec } from './instruments';
import { voiceChord } from './music-theory';
import { Synth } from '../modules/songbook-overlay';

export type MelodyPlayerOptions = {
  melody: SongMelody;
  bpm: number;
  transpose: number;
  melodySpec: SynthSpec | null;
  chordSpec: SynthSpec | null;
  octave: number;
  loop: { start: number; end: number } | null;
  uiTickMs?: number;
  maxChordNotes?: number;
};

export type MelodyPlayerState = {
  playing: boolean;
  beat: number;
  noteIndex: number;
  chord: string;
  melodyLit: number[];
  chordLit: number[];
};

const MELODY_GROUP = 800001;
const BACKING_GROUP = 800002;
const AUDITION_GROUP = 800003;

export function useMelodyPlayer({
  melody,
  bpm,
  transpose,
  melodySpec,
  chordSpec,
  octave,
  loop,
  maxChordNotes,
}: MelodyPlayerOptions) {
  const [state, setState] = useState<MelodyPlayerState>({
    playing: false,
    beat: 0,
    noteIndex: -1,
    chord: '',
    melodyLit: [],
    chordLit: [],
  });

  const beatRef = useRef(0);
  const playingRef = useRef(false);
  const lastNoteIdxRef = useRef(-1);
  const lastChordIdxRef = useRef(-1);

  const computeAtBeat = (b: number) => {
    let activeNoteIdx = -1;
    for (let i = 0; i < melody.notes.length; i++) {
      const n = melody.notes[i];
      if (b >= n.beat && b < n.beat + n.dur) {
        activeNoteIdx = i;
        break;
      }
    }

    let activeChordIdx = -1;
    for (let i = 0; i < melody.harmony.length; i++) {
      if (b >= melody.harmony[i].beat) {
        activeChordIdx = i;
      } else {
        break;
      }
    }

    const chordRaw = activeChordIdx >= 0 ? melody.harmony[activeChordIdx].chord : '';
    const chordSymbol = chordRaw ? transposeChord(chordRaw, transpose) : '';
    const noteObj = activeNoteIdx >= 0 ? melody.notes[activeNoteIdx] : null;
    const noteMidi = noteObj ? noteObj.midi + transpose + octave * 12 : null;

    let chordNotes = chordSymbol
      ? voiceChord(chordSymbol, { inversion: 'auto', octave: octave - 1, bass: true })
      : [];
    if (maxChordNotes && chordNotes.length > maxChordNotes) {
      chordNotes = chordNotes.slice(0, maxChordNotes);
    }

    return {
      activeNoteIdx,
      activeChordIdx,
      chordSymbol,
      noteMidi,
      chordNotes,
    };
  };

  useEffect(() => {
    if (!state.playing) {
      Synth.release(MELODY_GROUP);
      Synth.release(BACKING_GROUP);
      return undefined;
    }

    let lastTime = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const dtSec = (now - lastTime) / 1000;
      lastTime = now;

      const beatsPerSec = Math.max(30, bpm) / 60;
      let nextBeat = beatRef.current + dtSec * beatsPerSec;

      if (loop) {
        if (nextBeat >= loop.end || nextBeat < loop.start) {
          nextBeat = loop.start;
          lastNoteIdxRef.current = -1;
          lastChordIdxRef.current = -1;
        }
      } else if (nextBeat >= melody.beats) {
        nextBeat = 0;
        playingRef.current = false;
        beatRef.current = 0;
        lastNoteIdxRef.current = -1;
        lastChordIdxRef.current = -1;
        Synth.release(MELODY_GROUP);
        Synth.release(BACKING_GROUP);
        setState({
          playing: false,
          beat: 0,
          noteIndex: -1,
          chord: '',
          melodyLit: [],
          chordLit: [],
        });
        return;
      }

      beatRef.current = nextBeat;
      const info = computeAtBeat(nextBeat);

      if (info.activeNoteIdx !== lastNoteIdxRef.current) {
        Synth.release(MELODY_GROUP);
        if (info.noteMidi !== null && melodySpec) {
          Synth.playNotes([info.noteMidi], melodySpec, MELODY_GROUP);
        }
        lastNoteIdxRef.current = info.activeNoteIdx;
      }

      if (info.activeChordIdx !== lastChordIdxRef.current) {
        Synth.release(BACKING_GROUP);
        if (info.chordNotes.length > 0 && chordSpec) {
          Synth.playNotes(info.chordNotes, chordSpec, BACKING_GROUP);
        }
        lastChordIdxRef.current = info.activeChordIdx;
      }

      setState({
        playing: true,
        beat: nextBeat,
        noteIndex: info.activeNoteIdx,
        chord: info.chordSymbol,
        melodyLit: info.noteMidi !== null ? [info.noteMidi] : [],
        chordLit: chordSpec ? info.chordNotes : [],
      });
    }, 45);

    return () => {
      clearInterval(timer);
    };
  }, [state.playing, bpm, transpose, melodySpec, chordSpec, octave, loop, melody, maxChordNotes]);

  const seek = (beat: number) => {
    const clamped = Math.max(0, Math.min(melody.beats - 0.01, beat));
    beatRef.current = clamped;
    lastNoteIdxRef.current = -1;
    lastChordIdxRef.current = -1;
    const info = computeAtBeat(clamped);
    setState((prev) => ({
      ...prev,
      beat: clamped,
      noteIndex: info.activeNoteIdx,
      chord: info.chordSymbol,
      melodyLit: info.noteMidi !== null ? [info.noteMidi] : [],
      chordLit: chordSpec ? info.chordNotes : [],
    }));
  };

  const audition = (noteIdx: number) => {
    const n = melody.notes[noteIdx];
    if (!n) return;
    Synth.release(AUDITION_GROUP);
    const midi = n.midi + transpose + octave * 12;
    if (melodySpec) {
      Synth.playNotes([midi], melodySpec, AUDITION_GROUP);
      setTimeout(() => Synth.release(AUDITION_GROUP), 420);
    }
  };

  const pause = () => {
    playingRef.current = false;
    Synth.release(MELODY_GROUP);
    Synth.release(BACKING_GROUP);
    setState((s) => ({ ...s, playing: false }));
  };

  const toggle = () => {
    setState((s) => {
      const next = !s.playing;
      playingRef.current = next;
      if (!next) {
        Synth.release(MELODY_GROUP);
        Synth.release(BACKING_GROUP);
      } else {
        lastNoteIdxRef.current = -1;
        lastChordIdxRef.current = -1;
      }
      return { ...s, playing: next };
    });
  };

  return {
    state,
    seek,
    audition,
    pause,
    toggle,
  };
}
