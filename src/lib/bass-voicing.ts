import { parseChordIntervals } from './music-theory';
import type { BassStyle } from '../modules/songbook-overlay';

/**
 * Generates left-hand bass MIDI notes for a chord symbol in the chosen bass style:
 * - 'root': Single deep bass note
 * - 'octave': Root + octave (8va)
 * - 'fifth': Root + Fifth + Octave (1-5-8 power voicing)
 */
export function voiceBass(
  chord: string,
  style: BassStyle,
  octave: number,
  lowLimit = 28
): number[] {
  const { bassPc } = parseChordIntervals(chord);
  let rootMidi = 36 + octave * 12 + bassPc;
  while (rootMidi < lowLimit) rootMidi += 12;
  while (rootMidi > lowLimit + 16) rootMidi -= 12;

  if (style === 'root') {
    return [rootMidi];
  }
  if (style === 'octave') {
    return [rootMidi, rootMidi + 12];
  }
  // 'fifth' (1-5-8)
  return [rootMidi, rootMidi + 7, rootMidi + 12];
}
