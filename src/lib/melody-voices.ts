import type { SynthSpec } from './instruments';
import { keyChords, normalizeKeyLabel, parseChordIntervals, parseKey } from './music-theory';
import { transposeChord } from './chordpro';

export type MelodyVoice = {
  id: string;
  label: string;
  spec: SynthSpec | null;
};

export function melodyVoices(): MelodyVoice[] {
  return [
    {
      id: 'flute_lead',
      label: 'Warm Flute',
      spec: {
        wave: 'triangle',
        attack: 0.025,
        decay: 0.4,
        sustain: 0.75,
        release: 0.25,
        cutoff: 2600,
        detune: 5,
        gain: 0.65,
      },
    },
    {
      id: 'bell_epiano',
      label: 'Tine Bell',
      spec: {
        wave: 'epiano',
        attack: 0.006,
        decay: 0.65,
        sustain: 0.35,
        release: 0.35,
        cutoff: 3400,
        detune: 4,
        gain: 0.62,
        fmRatio: 2,
        fmDepth: 135,
      },
    },
    {
      id: 'synth_lead',
      label: 'Analog Lead',
      spec: {
        wave: 'sawtooth',
        attack: 0.015,
        decay: 0.35,
        sustain: 0.65,
        release: 0.22,
        cutoff: 2400,
        detune: 9,
        gain: 0.54,
      },
    },
    {
      id: 'plucked_harp',
      label: 'Koto Pluck',
      spec: {
        wave: 'pluck',
        attack: 0.004,
        decay: 0.55,
        sustain: 0.16,
        release: 0.3,
        cutoff: 3500,
        detune: 4,
        gain: 0.64,
      },
    },
    {
      id: 'mute',
      label: 'Silent (Visual)',
      spec: null,
    },
  ];
}

/**
 * Suggests diatonic and color chords in the song's key whose chord tones contain `midiNote`.
 */
export function harmonizeNote(
  midiNote: number,
  songKey?: string,
  transpose = 0
): string[] {
  const pc = ((midiNote % 12) + 12) % 12;
  const transposedKey = songKey ? transposeChord(songKey, transpose) : 'C';
  const parsed = parseKey(normalizeKeyLabel(transposedKey));
  const diatonic = keyChords(parsed, false).diatonic.map((d) => d.symbol);
  const diatonic7 = keyChords(parsed, true).diatonic.map((d) => d.symbol);

  const candidates = [...diatonic, ...diatonic7];
  const matches: string[] = [];

  for (const sym of candidates) {
    if (matches.includes(sym)) continue;
    const { root, intervals } = parseChordIntervals(sym);
    const chordPcs = intervals.map((iv) => (root + iv) % 12);
    if (chordPcs.includes(pc)) {
      matches.push(sym);
    }
  }

  return matches.slice(0, 6);
}
