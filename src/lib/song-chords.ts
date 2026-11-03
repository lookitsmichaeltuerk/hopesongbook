import type { Song } from './chordpro';

/**
 * Extracts all unique chords appearing in a song's sections, preserving order of appearance.
 */
export function songChords(song: Song): string[] {
  const seen = new Set<string>();
  const list: string[] = [];

  for (const sec of song.sections) {
    for (const line of sec.lines) {
      if (line.type === 'line') {
        for (const seg of line.segments) {
          if (seg.chord) {
            const c = seg.chord.trim();
            if (c && !seen.has(c)) {
              seen.add(c);
              list.push(c);
            }
          }
        }
      }
    }
  }

  if (song.melody?.harmony) {
    for (const h of song.melody.harmony) {
      const c = h.chord.trim();
      if (c && !seen.has(c)) {
        seen.add(c);
        list.push(c);
      }
    }
  }

  return list;
}
