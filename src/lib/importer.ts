import { parseChordPro, type Song, type SongMelody } from './chordpro';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read uploaded file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Processes an uploaded file (.chordpro, .cho, .pro, .txt, .pdf, or sheet music image)
 * and returns a structured `Song` with both ChordPro sections and a playable `SongMelody`.
 */
export async function importSongFromFile(
  file: File,
  onProgress?: (statusText: string) => void
): Promise<Song> {
  const name = file.name || 'Imported Song';
  const isChordProText =
    /\.(chordpro|cho|pro|chopro|txt)$/i.test(name) ||
    (file.type.startsWith('text/') && !name.toLowerCase().endsWith('.pdf'));

  if (isChordProText) {
    onProgress?.('Reading ChordPro file…');
    const textContent = await file.text();
    const hasBracesOrBrackets = /\[[A-G][^\]]*\]|\{title:/i.test(textContent);

    if (hasBracesOrBrackets) {
      const parsed = parseChordPro(textContent, `song_${Date.now()}`);
      if (!parsed.melody) {
        onProgress?.('Extracting playable lead melody from chords & lyrics…');
        try {
          const melody = await generateMelodyForChordPro(textContent);
          if (melody) parsed.melody = melody;
        } catch {
          // Keep parsed ChordPro even if melody synthesis is skipped
        }
      }
      return parsed;
    }

    // Plain lyrics/chords sheet -> ask server to convert to ChordPro + Melody
    onProgress?.('Formatting lead sheet into ChordPro & MIDI melody…');
    const response = await fetch('/api/parse-leadsheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: name,
        textContent,
      }),
    });
    if (!response.ok) {
      return parseChordPro(textContent, `song_${Date.now()}`);
    }
    const data = await response.json();
    return parseChordPro(data.chordPro || textContent, `song_${Date.now()}`, data.melody);
  }

  // PDF Lead Sheet or Image Score -> OMR via /api/parse-leadsheet
  onProgress?.('Scanning PDF lead sheet (chords, lyrics & melody notes)…');
  const base64Data = await fileToBase64(file);
  const mimeType =
    file.type || (name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png');

  const response = await fetch('/api/parse-leadsheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base64Data,
      mimeType,
      fileName: name,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Could not parse PDF lead sheet.');
  }

  const data = await response.json();
  return parseChordPro(data.chordPro, `song_${Date.now()}`, data.melody);
}

/**
 * Generates or extracts a playable `SongMelody` from a ChordPro string via `/api/generate-melody`.
 */
export async function generateMelodyForChordPro(chordPro: string): Promise<SongMelody | null> {
  const response = await fetch('/api/generate-melody', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chordPro }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate melody.');
  }

  const data = await response.json();
  return data.melody || null;
}
