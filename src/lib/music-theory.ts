import { pitchClassOf, transposeChord } from './chordpro';

export type ParsedKey = {
  root: number;
  minor: boolean;
  label: string;
};

export type HarmonicFunction = 'tonic' | 'sub' | 'dom' | 'color';

const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm']);

export function normalizeKeyLabel(raw?: string): string {
  if (!raw || !raw.trim()) return 'C';
  const m = raw.trim().match(/^([A-G][#b]?)(m|min|minor)?/i);
  if (!m) return 'C';
  return `${m[1][0].toUpperCase()}${m[1].slice(1)}${m[2] ? 'm' : ''}`;
}

export function parseKey(label: string): ParsedKey {
  const norm = normalizeKeyLabel(label);
  const minor = norm.endsWith('m');
  const rootName = minor ? norm.slice(0, -1) : norm;
  return {
    root: pitchClassOf(rootName),
    minor,
    label: norm,
  };
}

/**
 * Returns the diatonic chords for a key (I, ii, iii, IV, V, vi, vii° or minor equivalents).
 */
export function keyChords(key: ParsedKey, includeSevenths = false): { diatonic: { degree: string; symbol: string }[] } {
  const names = FLAT_KEYS.has(key.label) ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  const noteAt = (semitones: number) => names[(key.root + semitones + 120) % 12];

  if (!key.minor) {
    const steps = [
      { deg: 'I', semi: 0, qual: includeSevenths ? 'maj7' : '' },
      { deg: 'ii', semi: 2, qual: includeSevenths ? 'm7' : 'm' },
      { deg: 'iii', semi: 4, qual: includeSevenths ? 'm7' : 'm' },
      { deg: 'IV', semi: 5, qual: includeSevenths ? 'maj7' : '' },
      { deg: 'V', semi: 7, qual: includeSevenths ? '7' : '' },
      { deg: 'vi', semi: 9, qual: includeSevenths ? 'm7' : 'm' },
      { deg: 'vii°', semi: 11, qual: 'dim' },
    ];
    return {
      diatonic: steps.map((s) => ({
        degree: s.deg,
        symbol: `${noteAt(s.semi)}${s.qual}`,
      })),
    };
  } else {
    const steps = [
      { deg: 'i', semi: 0, qual: includeSevenths ? 'm7' : 'm' },
      { deg: 'III', semi: 3, qual: includeSevenths ? 'maj7' : '' },
      { deg: 'iv', semi: 5, qual: includeSevenths ? 'm7' : 'm' },
      { deg: 'v', semi: 7, qual: includeSevenths ? 'm7' : 'm' },
      { deg: 'V7', semi: 7, qual: '7' },
      { deg: 'VI', semi: 8, qual: includeSevenths ? 'maj7' : '' },
      { deg: 'VII', semi: 10, qual: '' },
    ];
    return {
      diatonic: steps.map((s) => ({
        degree: s.deg,
        symbol: `${noteAt(s.semi)}${s.qual}`,
      })),
    };
  }
}

/**
 * Classifies a chord's harmonic function within `key` for visual color coding on pads:
 * - tonic (I, vi, iii) -> green
 * - sub (IV, ii) -> blue
 * - dom (V, vii°) -> red
 * - color (borrowed / secondary / chromatic) -> purple
 */
export function chordFunction(chord: string, key: ParsedKey): HarmonicFunction {
  const m = chord.trim().match(/^([A-G][#b]?)/);
  if (!m) return 'color';
  const root = pitchClassOf(m[1]);
  const interval = (((root - key.root) % 12) + 12) % 12;

  if (!key.minor) {
    if (interval === 0 || interval === 9 || interval === 4) return 'tonic';
    if (interval === 5 || interval === 2) return 'sub';
    if (interval === 7 || interval === 11) return 'dom';
    return 'color';
  } else {
    if (interval === 0 || interval === 3 || interval === 8) return 'tonic';
    if (interval === 5 || interval === 2) return 'sub';
    if (interval === 7 || interval === 10 || interval === 11) return 'dom';
    return 'color';
  }
}

/**
 * Parses a chord symbol into its root pitch class, intervals above root, and optional slash bass pitch class.
 */
export function parseChordIntervals(chord: string): { root: number; intervals: number[]; bassPc: number } {
  const cleaned = chord.trim();
  const [mainPart, slashPart] = cleaned.split('/');
  const m = mainPart.match(/^([A-G][#b]?)(.*)$/);
  if (!m) {
    return { root: 0, intervals: [0, 4, 7], bassPc: 0 };
  }
  const root = pitchClassOf(m[1]);
  const qual = m[2] || '';
  const bassPc = slashPart ? pitchClassOf(slashPart.trim()) : root;

  let third = 4;
  let fifth = 7;
  if (/^m(?!aj)/i.test(qual) || qual.includes('min') || qual.includes('-')) {
    third = 3;
  }
  if (qual.includes('dim') || qual.includes('°')) {
    third = 3;
    fifth = 6;
  } else if (qual.includes('aug') || qual.includes('+')) {
    fifth = 8;
  } else if (qual.includes('b5')) {
    fifth = 6;
  } else if (qual.includes('sus2')) {
    third = 2;
  } else if (qual.includes('sus4') || qual.includes('sus')) {
    third = 5;
  }

  if (qual === '5') {
    return { root, intervals: [0, 7], bassPc };
  }

  const intervals = [0, third, fifth];

  if (qual.includes('maj7') || qual.includes('M7')) {
    intervals.push(11);
  } else if (qual.includes('dim7')) {
    intervals.push(9);
  } else if (qual.includes('7')) {
    intervals.push(10);
  } else if (qual.includes('6')) {
    intervals.push(9);
  }

  if (qual.includes('add9') || qual.includes('9')) {
    intervals.push(14);
  }

  return { root, intervals, bassPc };
}

export type VoiceOptions = {
  inversion?: 'root' | 'auto';
  style?: 'close' | 'open';
  octave?: number;
  bass?: boolean;
};

/**
 * Generates smooth, voice-led MIDI notes for a chord symbol.
 * When `prev` is provided and `inversion === 'auto'`, selects the inversion closest to the previous voicing's centroid.
 */
export function voiceChord(
  chord: string,
  options: VoiceOptions = {},
  prev?: number[]
): number[] {
  const { inversion = 'auto', octave = 0, bass = true } = options;
  const { root, intervals, bassPc } = parseChordIntervals(chord);
  const centerMidi = 60 + octave * 12; // Middle C4 = 60

  const pitchClasses = intervals.map((iv) => (root + iv) % 12);

  // Build candidate inversions around centerMidi
  const candidates: number[][] = [];
  for (let baseOct = 48 + octave * 12; baseOct <= 60 + octave * 12; baseOct += 12) {
    for (let inv = 0; inv < pitchClasses.length; inv++) {
      const voiced: number[] = [];
      for (let i = 0; i < pitchClasses.length; i++) {
        const pc = pitchClasses[(inv + i) % pitchClasses.length];
        let midi = baseOct + pc;
        while (voiced.length > 0 && midi <= voiced[voiced.length - 1]) {
          midi += 12;
        }
        voiced.push(midi);
      }
      candidates.push(voiced);
    }
  }

  let chosen = candidates[0] || [60, 64, 67];
  if (inversion === 'root') {
    const base = 60 + octave * 12 + root;
    const adjustedBase = base > 66 + octave * 12 ? base - 12 : base;
    chosen = intervals.map((iv) => adjustedBase + iv);
  } else {
    const targetCentroid =
      prev && prev.length > 0
        ? prev.filter((n) => n >= 48).reduce((a, b) => a + b, 0) / Math.max(1, prev.filter((n) => n >= 48).length)
        : centerMidi + 4;

    let bestDist = Infinity;
    for (const cand of candidates) {
      const centroid = cand.reduce((a, b) => a + b, 0) / cand.length;
      const dist = Math.abs(centroid - targetCentroid);
      if (dist < bestDist) {
        bestDist = dist;
        chosen = cand;
      }
    }
  }

  if (bass) {
    let bassMidi = 36 + octave * 12 + bassPc;
    if (bassMidi >= chosen[0] - 5) bassMidi -= 12;
    return [bassMidi, ...chosen];
  }

  return chosen;
}

export { transposeChord };
