import type { Instrument } from './instruments';
import { parseChordIntervals } from './music-theory';

/**
 * Voices a chord idiomatically within a world string instrument's physical pitch range (`low`..`high`).
 */
export function voiceForStrings(
  chord: string,
  instrument: Instrument,
  octave: number
): number[] {
  const { root, intervals } = parseChordIntervals(chord);
  const baseMidi = 60 + octave * 12 + root;

  const notes: number[] = [];
  for (const iv of intervals) {
    let n = baseMidi + iv;
    while (n < instrument.low) n += 12;
    while (n > instrument.high) n -= 12;
    if (!notes.includes(n)) notes.push(n);
  }

  // Add a resonant upper octave tone if within instrument range
  const topRoot = baseMidi + 12;
  if (topRoot >= instrument.low && topRoot <= instrument.high && !notes.includes(topRoot)) {
    notes.push(topRoot);
  }

  return notes.sort((a, b) => a - b);
}
