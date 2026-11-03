export type LineSegment = {
  chord?: string;
  lyric: string;
};

export type SongLine =
  | { type: 'empty' }
  | { type: 'comment'; text: string }
  | { type: 'line'; segments: LineSegment[] };

export type SongSection = {
  kind: 'verse' | 'chorus' | 'bridge' | 'other';
  label: string;
  lines: SongLine[];
};

export type MelodyNote = {
  midi: number;
  beat: number;
  dur: number;
  syllable?: string;
};

export type MelodyHarmony = {
  beat: number;
  chord: string;
};

export type SongMelody = {
  beats: number;
  notes: MelodyNote[];
  harmony: MelodyHarmony[];
};

export type Song = {
  id: string;
  title: string;
  artist?: string;
  key?: string;
  tempo: number;
  time: string;
  sections: SongSection[];
  melody?: SongMelody;
  raw: string;
};

export const NEW_SONG_TEMPLATE = `{title: New Song}
{artist: }
{key: C}
{tempo: 100}
{time: 4/4}

{start_of_verse}
[C]Write your [G]lyrics with [Am]chords in [F]brackets
[C]Every [G]line aligns [F]cleanly on [C]stage
{end_of_verse}

{start_of_chorus}
[F]Hold a [C]chord pad to [G]hear the [Am]voicing
[F]Float this [C]sheet over [G]any other [C]app
{end_of_chorus}
`;

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const ENHARMONIC_INDEX: Record<string, number> = {
  C: 0,
  'B#': 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  'E#': 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

export function pitchClassOf(note: string): number {
  return ENHARMONIC_INDEX[note] ?? 0;
}

/**
 * Transposes a chord symbol (including slash bass chords like "G/B" or "F#m7b5") by `steps` semitones.
 */
export function transposeChord(chord: string, steps: number): string {
  if (!steps || !chord) return chord;
  const preferFlats = chord.includes('b') || steps < 0;
  return chord.replace(/([A-G][#b]?)/g, (match) => {
    const idx = ENHARMONIC_INDEX[match];
    if (idx === undefined) return match;
    const nextIdx = (((idx + steps) % 12) + 12) % 12;
    return preferFlats ? FLATS[nextIdx] : SHARPS[nextIdx];
  });
}

/**
 * Parses a ChordPro source string into a structured `Song` object.
 */
export function parseChordPro(
  source: string,
  id: string = `song_${Date.now()}`,
  existingMelody?: SongMelody
): Song {
  const lines = source.split(/\r?\n/);
  let title = 'Untitled Song';
  let artist: string | undefined;
  let key: string | undefined = 'C';
  let tempo = 100;
  let time = '4/4';
  let parsedMelody: SongMelody | undefined = existingMelody;

  const sections: SongSection[] = [];
  let currentSection: SongSection = {
    kind: 'verse',
    label: 'Verse',
    lines: [],
  };

  const pushCurrentSection = () => {
    // Trim leading/trailing empty lines inside a section
    while (currentSection.lines.length > 0 && currentSection.lines[0].type === 'empty') {
      currentSection.lines.shift();
    }
    while (
      currentSection.lines.length > 0 &&
      currentSection.lines[currentSection.lines.length - 1].type === 'empty'
    ) {
      currentSection.lines.pop();
    }
    if (currentSection.lines.length > 0) {
      sections.push(currentSection);
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    // Check for directive: {tag: value} or {tag}
    const dirMatch = trimmed.match(/^\{([a-zA-Z0-9_]+)(?::\s*(.*))?\}$/);
    if (dirMatch) {
      const [, rawTag, rawVal = ''] = dirMatch;
      const tag = rawTag.toLowerCase();
      const val = rawVal.trim();

      if (tag === 'title' || tag === 't') {
        if (val) title = val;
      } else if (tag === 'artist' || tag === 'a' || tag === 'subtitle' || tag === 'st') {
        if (val) artist = val;
      } else if (tag === 'key' || tag === 'k') {
        if (val) key = val;
      } else if (tag === 'tempo' || tag === 'bpm') {
        const n = parseInt(val, 10);
        if (!Number.isNaN(n) && n >= 30 && n <= 300) tempo = n;
      } else if (tag === 'time') {
        if (val) time = val;
      } else if (tag === 'melody_json' && val) {
        try {
          parsedMelody = JSON.parse(val);
        } catch {
          // ignore malformed embedded melody JSON
        }
      } else if (tag === 'comment' || tag === 'c') {
        if (val) currentSection.lines.push({ type: 'comment', text: val });
      } else if (tag === 'start_of_chorus' || tag === 'soc') {
        pushCurrentSection();
        currentSection = { kind: 'chorus', label: val || 'Chorus', lines: [] };
      } else if (tag === 'start_of_verse' || tag === 'sov') {
        pushCurrentSection();
        currentSection = { kind: 'verse', label: val || 'Verse', lines: [] };
      } else if (tag === 'start_of_bridge' || tag === 'sob') {
        pushCurrentSection();
        currentSection = { kind: 'bridge', label: val || 'Bridge', lines: [] };
      } else if (
        tag === 'end_of_chorus' ||
        tag === 'eoc' ||
        tag === 'end_of_verse' ||
        tag === 'eov' ||
        tag === 'end_of_bridge' ||
        tag === 'eob'
      ) {
        pushCurrentSection();
        currentSection = { kind: 'verse', label: 'Verse', lines: [] };
      }
      continue;
    }

    if (!trimmed) {
      currentSection.lines.push({ type: 'empty' });
      continue;
    }

    // Parse inline [Chord]Lyric segments
    const segments: LineSegment[] = [];
    const regex = /\[([^\]]+)\]([^\[]*)/g;
    const firstBracket = rawLine.indexOf('[');

    if (firstBracket === -1) {
      segments.push({ lyric: rawLine });
    } else {
      if (firstBracket > 0) {
        segments.push({ lyric: rawLine.slice(0, firstBracket) });
      }
      let match: RegExpExecArray | null;
      while ((match = regex.exec(rawLine)) !== null) {
        segments.push({
          chord: match[1].trim(),
          lyric: match[2],
        });
      }
    }

    currentSection.lines.push({ type: 'line', segments });
  }

  pushCurrentSection();

  if (sections.length === 0) {
    sections.push({
      kind: 'verse',
      label: 'Verse',
      lines: [{ type: 'line', segments: [{ chord: key || 'C', lyric: 'Tap Edit to add lyrics & chords' }] }],
    });
  }

  return {
    id,
    title,
    artist,
    key,
    tempo,
    time,
    sections,
    melody: parsedMelody,
    raw: source,
  };
}

/**
 * Formats a Song into plain readable Chord-over-Lyric text for clipboard sharing.
 */
export function songToText(song: Song, transpose: number = 0): string {
  const keyLabel = song.key ? transposeChord(song.key, transpose) : '';
  const header = [
    song.title,
    [song.artist, keyLabel && `Key: ${keyLabel}`, `${song.tempo} BPM`, song.time].filter(Boolean).join(' · '),
    '',
  ].join('\n');

  const body = song.sections
    .map((sec) => {
      const lines = sec.lines
        .map((l) => {
          if (l.type === 'empty') return '';
          if (l.type === 'comment') return `(${l.text})`;
          let chordRow = '';
          let lyricRow = '';
          for (const seg of l.segments) {
            const c = seg.chord ? transposeChord(seg.chord, transpose) : '';
            const lyr = seg.lyric || '';
            const width = Math.max(c.length + (c ? 1 : 0), lyr.length);
            chordRow += c.padEnd(width, ' ');
            lyricRow += lyr.padEnd(width, ' ');
          }
          return chordRow.trim() ? `${chordRow.trimEnd()}\n${lyricRow.trimEnd()}` : lyricRow.trimEnd();
        })
        .join('\n');
      return `[${sec.label.toUpperCase()}]\n${lines}`;
    })
    .join('\n\n');

  return `${header}\n${body}`.trim();
}
