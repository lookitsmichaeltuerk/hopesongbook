import type { BassStyle } from '../modules/songbook-overlay';

export type PadSettings = {
  octave: number;
  bassStyle: BassStyle;
  bassWithChords: boolean;
  grooveId: string;
  keysId: string;
  bassId: string;
  stringsId: string;
};

export const DEFAULT_PAD_SETTINGS: PadSettings = {
  octave: 0,
  bassStyle: 'fifth',
  bassWithChords: true,
  grooveId: 'rock1',
  keysId: 'epiano',
  bassId: 'ac_bass',
  stringsId: 'koto',
};
