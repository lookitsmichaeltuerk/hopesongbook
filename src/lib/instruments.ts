export type InstrumentEra = 'modern' | 'classic';

export type SynthSpec = {
  wave: 'sine' | 'triangle' | 'sawtooth' | 'square' | 'epiano' | 'pluck' | 'organ' | 'pad';
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  cutoff: number;
  detune: number;
  gain: number;
  fmRatio?: number;
  fmDepth?: number;
  strumMs?: number;
};

export type Instrument = {
  id: string;
  name: string;
  region: string;
  era: InstrumentEra;
  category?: string;
  /** Lowest MIDI pitch */
  low: number;
  /** Highest MIDI pitch */
  high: number;
  spec: SynthSpec;
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function midiToLabel(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${oct}`;
}

export function rangeLabel(inst: Instrument): string {
  return `${midiToLabel(inst.low)}–${midiToLabel(inst.high)}`;
}

export function categoriesOf(instruments: Instrument[]): string[] {
  const set = new Set<string>();
  for (const inst of instruments) {
    if (inst.category) set.add(inst.category);
  }
  return Array.from(set);
}

export const KEY_INSTRUMENTS: Instrument[] = [
  {
    id: 'epiano',
    name: 'Stage Rhodes MkI',
    region: 'USA',
    era: 'modern',
    category: 'Pianos',
    low: 28,
    high: 96,
    spec: {
      wave: 'epiano',
      attack: 0.012,
      decay: 0.65,
      sustain: 0.45,
      release: 0.45,
      cutoff: 2400,
      detune: 4,
      gain: 0.55,
      fmRatio: 2,
      fmDepth: 120,
    },
  },
  {
    id: 'grand',
    name: 'Studio Felt Grand',
    region: 'Germany',
    era: 'classic',
    category: 'Pianos',
    low: 21,
    high: 108,
    spec: {
      wave: 'triangle',
      attack: 0.008,
      decay: 0.8,
      sustain: 0.35,
      release: 0.5,
      cutoff: 1900,
      detune: 3,
      gain: 0.6,
      fmRatio: 1,
      fmDepth: 85,
    },
  },
  {
    id: 'wurli',
    name: '200A Reed E-Piano',
    region: 'USA',
    era: 'modern',
    category: 'Pianos',
    low: 33,
    high: 96,
    spec: {
      wave: 'epiano',
      attack: 0.008,
      decay: 0.5,
      sustain: 0.4,
      release: 0.35,
      cutoff: 3100,
      detune: 6,
      gain: 0.52,
      fmRatio: 3,
      fmDepth: 160,
    },
  },
  {
    id: 'warm_pad',
    name: 'Juno Chorus Pad',
    region: 'Japan',
    era: 'modern',
    category: 'Synths',
    low: 36,
    high: 96,
    spec: {
      wave: 'pad',
      attack: 0.14,
      decay: 0.8,
      sustain: 0.78,
      release: 0.75,
      cutoff: 1650,
      detune: 14,
      gain: 0.44,
    },
  },
  {
    id: 'analog_poly',
    name: 'Prophet Brass Poly',
    region: 'USA',
    era: 'modern',
    category: 'Synths',
    low: 36,
    high: 96,
    spec: {
      wave: 'sawtooth',
      attack: 0.035,
      decay: 0.45,
      sustain: 0.55,
      release: 0.45,
      cutoff: 2100,
      detune: 10,
      gain: 0.4,
    },
  },
  {
    id: 'b3_organ',
    name: 'Tonewheel Drawbar Organ',
    region: 'USA',
    era: 'classic',
    category: 'Organs',
    low: 36,
    high: 96,
    spec: {
      wave: 'organ',
      attack: 0.015,
      decay: 0.2,
      sustain: 0.85,
      release: 0.18,
      cutoff: 2800,
      detune: 5,
      gain: 0.48,
    },
  },
  {
    id: 'vibraphone',
    name: 'Jazz Vibraphone',
    region: 'USA',
    era: 'modern',
    category: 'Mallets',
    low: 53,
    high: 89,
    spec: {
      wave: 'epiano',
      attack: 0.006,
      decay: 0.9,
      sustain: 0.25,
      release: 0.7,
      cutoff: 3600,
      detune: 7,
      gain: 0.5,
      fmRatio: 4,
      fmDepth: 210,
    },
  },
  {
    id: 'marimba',
    name: 'Rosewood Marimba',
    region: 'Mexico / Guatemala',
    era: 'classic',
    category: 'Mallets',
    low: 45,
    high: 96,
    spec: {
      wave: 'sine',
      attack: 0.005,
      decay: 0.28,
      sustain: 0.08,
      release: 0.22,
      cutoff: 2200,
      detune: 2,
      gain: 0.62,
      fmRatio: 4,
      fmDepth: 90,
    },
  },
];

export const BASS_INSTRUMENTS: Instrument[] = [
  {
    id: 'ac_bass',
    name: 'Upright Double Bass',
    region: 'Europe / Jazz',
    era: 'classic',
    category: 'Acoustic',
    low: 28,
    high: 67,
    spec: {
      wave: 'triangle',
      attack: 0.012,
      decay: 0.45,
      sustain: 0.5,
      release: 0.35,
      cutoff: 780,
      detune: 2,
      gain: 0.72,
    },
  },
  {
    id: 'p_bass',
    name: 'Flatwound Precision Bass',
    region: 'USA',
    era: 'modern',
    category: 'Electric',
    low: 28,
    high: 67,
    spec: {
      wave: 'sawtooth',
      attack: 0.008,
      decay: 0.38,
      sustain: 0.55,
      release: 0.28,
      cutoff: 920,
      detune: 3,
      gain: 0.62,
    },
  },
  {
    id: 'moog_sub',
    name: 'Ladder Filter Sub Bass',
    region: 'USA',
    era: 'modern',
    category: 'Synth Bass',
    low: 24,
    high: 60,
    spec: {
      wave: 'sawtooth',
      attack: 0.01,
      decay: 0.35,
      sustain: 0.68,
      release: 0.3,
      cutoff: 640,
      detune: 8,
      gain: 0.65,
    },
  },
  {
    id: 'cello_bass',
    name: 'Orchestral Cello Section',
    region: 'Italy',
    era: 'classic',
    category: 'Bowed',
    low: 36,
    high: 76,
    spec: {
      wave: 'pad',
      attack: 0.08,
      decay: 0.5,
      sustain: 0.75,
      release: 0.5,
      cutoff: 1200,
      detune: 9,
      gain: 0.6,
    },
  },
];

export const STRING_INSTRUMENTS: Instrument[] = [
  {
    id: 'koto',
    name: '13-String Koto',
    region: 'Japan',
    era: 'classic',
    category: 'East Asia',
    low: 48,
    high: 84,
    spec: {
      wave: 'pluck',
      attack: 0.004,
      decay: 0.55,
      sustain: 0.12,
      release: 0.42,
      cutoff: 3400,
      detune: 4,
      gain: 0.48,
      strumMs: 32,
    },
  },
  {
    id: 'kora',
    name: '21-String Calabash Kora',
    region: 'West Africa (Mali / Senegal)',
    era: 'classic',
    category: 'Africa',
    low: 48,
    high: 86,
    spec: {
      wave: 'pluck',
      attack: 0.005,
      decay: 0.62,
      sustain: 0.16,
      release: 0.48,
      cutoff: 2600,
      detune: 3,
      gain: 0.5,
      strumMs: 26,
    },
  },
  {
    id: 'sitar',
    name: 'Sympathetic Concert Sitar',
    region: 'India',
    era: 'classic',
    category: 'South Asia',
    low: 48,
    high: 84,
    spec: {
      wave: 'pluck',
      attack: 0.008,
      decay: 0.85,
      sustain: 0.24,
      release: 0.65,
      cutoff: 3800,
      detune: 12,
      gain: 0.44,
      fmRatio: 1.5,
      fmDepth: 140,
      strumMs: 36,
    },
  },
  {
    id: 'guzheng',
    name: 'Silk-String Guzheng',
    region: 'China',
    era: 'classic',
    category: 'East Asia',
    low: 48,
    high: 88,
    spec: {
      wave: 'pluck',
      attack: 0.005,
      decay: 0.72,
      sustain: 0.18,
      release: 0.55,
      cutoff: 3200,
      detune: 5,
      gain: 0.48,
      strumMs: 38,
    },
  },
  {
    id: 'celtic_harp',
    name: 'Clàrsach Celtic Harp',
    region: 'Ireland / Scotland',
    era: 'classic',
    category: 'Europe',
    low: 43,
    high: 88,
    spec: {
      wave: 'triangle',
      attack: 0.006,
      decay: 0.85,
      sustain: 0.22,
      release: 0.65,
      cutoff: 2400,
      detune: 4,
      gain: 0.52,
      strumMs: 42,
    },
  },
  {
    id: 'nylon_guitar',
    name: 'Spanish Nylon Guitar',
    region: 'Spain / Latin America',
    era: 'modern',
    category: 'Guitars',
    low: 40,
    high: 84,
    spec: {
      wave: 'pluck',
      attack: 0.005,
      decay: 0.58,
      sustain: 0.18,
      release: 0.4,
      cutoff: 2500,
      detune: 3,
      gain: 0.5,
      strumMs: 28,
    },
  },
  {
    id: 'twelve_string',
    name: '12-String Dreadnought',
    region: 'USA',
    era: 'modern',
    category: 'Guitars',
    low: 40,
    high: 84,
    spec: {
      wave: 'pluck',
      attack: 0.006,
      decay: 0.68,
      sustain: 0.24,
      release: 0.48,
      cutoff: 3600,
      detune: 11,
      gain: 0.46,
      strumMs: 24,
    },
  },
  {
    id: 'chamber_strings',
    name: 'Warm Studio Strings',
    region: 'Vienna / London',
    era: 'modern',
    category: 'Ensemble',
    low: 43,
    high: 91,
    spec: {
      wave: 'pad',
      attack: 0.16,
      decay: 0.7,
      sustain: 0.8,
      release: 0.75,
      cutoff: 2200,
      detune: 13,
      gain: 0.42,
    },
  },
  {
    id: 'oud',
    name: 'Fretless Arabic Oud',
    region: 'Middle East / North Africa',
    era: 'classic',
    category: 'Middle East',
    low: 43,
    high: 79,
    spec: {
      wave: 'pluck',
      attack: 0.005,
      decay: 0.5,
      sustain: 0.14,
      release: 0.35,
      cutoff: 2300,
      detune: 5,
      gain: 0.5,
      strumMs: 22,
    },
  },
];

export type DrumKind =
  | 'kick'
  | 'snare'
  | 'rim'
  | 'ch'
  | 'oh'
  | 'clap'
  | 'ltom'
  | 'htom'
  | 'crash'
  | 'ride'
  | 'shaker'
  | 'cowbell';

export type DrumPadDef = {
  kind: DrumKind;
  label: string;
  name: string;
};

export const DRUM_PADS: DrumPadDef[] = [
  { kind: 'kick', label: 'BD', name: 'Bass Drum' },
  { kind: 'snare', label: 'SD', name: 'Snare Drum' },
  { kind: 'rim', label: 'RM', name: 'Side Stick / Rim' },
  { kind: 'ch', label: 'CH', name: 'Closed Hi-Hat' },
  { kind: 'oh', label: 'OH', name: 'Open Hi-Hat' },
  { kind: 'clap', label: 'CP', name: 'Hand Clap' },
  { kind: 'ltom', label: 'LT', name: 'Low Floor Tom' },
  { kind: 'htom', label: 'HT', name: 'High Rack Tom' },
  { kind: 'crash', label: 'CR', name: 'Crash Cymbal' },
  { kind: 'ride', label: 'RD', name: 'Ride Bell' },
  { kind: 'shaker', label: 'SH', name: 'Studio Shaker' },
  { kind: 'cowbell', label: 'CB', name: '808 Cowbell' },
];

export type GrooveDef = {
  id: string;
  name: string;
  /** 16-character step string per DrumKind where 'x' or 'X' triggers */
  rows: Partial<Record<DrumKind, string>>;
};

export const GROOVES: GrooveDef[] = [
  {
    id: 'rock1',
    name: 'Indie Backbeat',
    rows: {
      kick: 'X...x..xX...x...',
      snare: '....X.......X...',
      ch: 'x.x.x.x.x.x.x.x.',
    },
  },
  {
    id: 'worship',
    name: 'Anthem Pulse',
    rows: {
      kick: 'X...X...X...X...',
      snare: '....X.......X..x',
      ltom: 'x.x.x.x.x.x.x.x.',
      shaker: 'xxxx.xxxxxxx.xxx',
    },
  },
  {
    id: 'neosoul',
    name: 'Pocket Soul',
    rows: {
      kick: 'X..x..x...x.x...',
      rim: '....X.......X...',
      ch: 'x.x.x.x.x.x.x.x.',
      shaker: '..x...x...x...x.',
    },
  },
  {
    id: 'folk',
    name: 'Acoustic Busker',
    rows: {
      kick: 'X.......X...x...',
      rim: '....x..x....x...',
      shaker: 'x.x.x.x.x.x.x.x.',
    },
  },
  {
    id: 'bossa',
    name: 'Bossa Clave',
    rows: {
      kick: 'X..xX..xX..xX..x',
      rim: 'x..x..x...x..x..',
      shaker: 'xxxxxxxxxxxxxxxx',
    },
  },
  {
    id: 'waltz',
    name: 'Gospel 6/8 Feel',
    rows: {
      kick: 'X.....x.X.......',
      rim: '....X.......X...',
      ride: 'x.x.x.x.x.x.x.x.',
    },
  },
];
