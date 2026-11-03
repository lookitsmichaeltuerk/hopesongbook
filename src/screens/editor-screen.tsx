import { useMemo, useRef, useState } from 'react';
import { parseChordPro, transposeChord, type SongMelody } from '../lib/chordpro';
import { generateMelodyForChordPro } from '../lib/importer';

export type EditorScreenProps = {
  initial: string;
  initialMelody?: SongMelody;
  isNew: boolean;
  onSave: (source: string, melody?: SongMelody) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onImportFile?: () => void;
};

const COMMON_CHORDS = [
  '[ ]',
  '[C]',
  '[G]',
  '[Am]',
  '[F]',
  '[Dm]',
  '[Em]',
  '[D]',
  '[A]',
  '[E7]',
  '[G7]',
  '[Fmaj7]',
];

const DIRECTIVES = [
  { label: '{Verse}', text: '\n{start_of_verse: Verse}\n\n{end_of_verse}\n' },
  { label: '{Chorus}', text: '\n{start_of_chorus: Chorus}\n\n{end_of_chorus}\n' },
  { label: '{Bridge}', text: '\n{start_of_bridge: Bridge}\n\n{end_of_bridge}\n' },
  { label: '{comment}', text: '{comment: }' },
  { label: '{key: }', text: '{key: C}' },
  { label: '{tempo: }', text: '{tempo: 100}' },
];

/**
 * Modernized ChordPro editor with cursor-aware quick-insert bar, live side-by-side preview,
 * file/PDF lead sheet import trigger, and 1-tap melody extraction.
 */
export function EditorScreen({
  initial,
  initialMelody,
  isNew,
  onSave,
  onCancel,
  onDelete,
  onImportFile,
}: EditorScreenProps) {
  const [text, setText] = useState(initial);
  const [melody, setMelody] = useState<SongMelody | undefined>(initialMelody);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [generatingMelody, setGeneratingMelody] = useState(false);
  const [melodyStatus, setMelodyStatus] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const previewSong = useMemo(() => parseChordPro(text, 'preview', melody), [text, melody]);

  const insertAtCursor = (snippet: string) => {
    const el = textareaRef.current;
    const actual = snippet === '[ ]' ? '[]' : snippet;
    if (!el) {
      setText((prev) => prev + actual);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + actual + text.slice(end);
    setText(next);

    requestAnimationFrame(() => {
      el.focus();
      const cursorOffset = snippet === '[ ]' ? start + 1 : start + actual.length;
      el.setSelectionRange(cursorOffset, cursorOffset);
    });
  };

  const handleGenerateMelody = async () => {
    setGeneratingMelody(true);
    setMelodyStatus('Transcribing lead melody from chords & lyrics…');
    try {
      const generated = await generateMelodyForChordPro(text);
      if (generated) {
        setMelody(generated);
        setMelodyStatus(`Ready: ${generated.notes.length} melody notes synced`);
      }
    } catch (err: any) {
      setMelodyStatus(err?.message || 'Could not generate melody');
    } finally {
      setGeneratingMelody(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-[#0b0d12] p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] rounded-xl border border-[#283042] bg-[#1b212e] px-4 text-sm font-bold text-[#f3f5f8] hover:border-[#ff8a1f] whitespace-nowrap shrink-0"
        >
          Cancel
        </button>

        <h1 className="text-lg font-extrabold text-[#f3f5f8]">
          {isNew ? 'New Song' : 'Edit Song'}
        </h1>

        <button
          type="button"
          onClick={() => onSave(text, melody)}
          className="min-h-[44px] rounded-xl border border-[#ff8a1f] bg-[#ff8a1f] px-5 text-sm font-extrabold text-[#111] transition-transform active:scale-95 whitespace-nowrap shrink-0"
        >
          Save Song
        </button>
      </div>

      {/* Action Bar: Import File/PDF, Generate Melody, Toggle Preview */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {onImportFile && (
            <button
              type="button"
              onClick={onImportFile}
              className="min-h-[38px] rounded-lg border border-[#283042] bg-[#1b212e] px-3 text-xs font-bold text-[#ffae52] hover:border-[#ff8a1f] whitespace-nowrap shrink-0"
            >
              📂 Import .ChordPro or PDF Lead Sheet
            </button>
          )}

          <button
            type="button"
            disabled={generatingMelody}
            onClick={handleGenerateMelody}
            className="min-h-[38px] rounded-lg border border-[#283042] bg-[#1b212e] px-3 text-xs font-bold text-[#6ad3ff] hover:border-[#6ad3ff] disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {generatingMelody
              ? '◌ Building Lead Melody…'
              : melody
              ? `♪ Rebuild Melody (${melody.notes.length} notes)`
              : '♪ Auto-Generate Lead Melody'}
          </button>

          {melodyStatus && (
            <span className="text-xs text-[#8d96a8]">{melodyStatus}</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          className="min-h-[38px] rounded-lg border border-[#283042] bg-[#12161f] px-3 text-xs font-semibold text-[#8d96a8] hover:text-[#f3f5f8] whitespace-nowrap shrink-0"
        >
          {showPreview ? 'Hide Live Preview' : 'Show Live Preview'}
        </button>
      </div>

      {/* Quick-Insert Chord & Directive Bar */}
      <div className="mb-2.5 flex items-center gap-1.5 overflow-x-auto rounded-xl border border-[#1d2331] bg-[#12161f] p-2">
        {COMMON_CHORDS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => insertAtCursor(c)}
            className="min-h-[36px] rounded-lg border border-[#283042] bg-[#1b212e] px-2.5 font-mono text-xs font-extrabold text-[#ffae52] hover:border-[#ff8a1f] whitespace-nowrap shrink-0"
          >
            {c}
          </button>
        ))}
        <div className="mx-1 h-5 w-px bg-[#283042] shrink-0" />
        {DIRECTIVES.map((d) => (
          <button
            key={d.label}
            type="button"
            onClick={() => insertAtCursor(d.text)}
            className="min-h-[36px] rounded-lg border border-[#283042] bg-[#1b212e] px-2.5 font-mono text-xs font-semibold text-[#8d96a8] hover:text-[#f3f5f8] whitespace-nowrap shrink-0"
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Editor + Optional Live Side-by-Side Preview */}
      <div
        className={`grid flex-1 gap-4 ${
          showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
        }`}
      >
        <div className="flex flex-col">
          <div className="mb-1.5 text-xs text-[#8d96a8]">
            ChordPro Source: <code className="text-[#ffae52]">{'{title: …}'}</code>{' '}
            directives, <code className="text-[#ffae52]">[Chords]</code> inline
            with lyrics.
          </div>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="min-h-[360px] flex-1 resize-none rounded-xl border border-[#1d2331] bg-[#12161f] p-4 font-mono text-sm leading-relaxed text-[#f3f5f8] focus:border-[#ff8a1f] focus:outline-none"
          />
        </div>

        {showPreview && (
          <div className="flex flex-col">
            <div className="mb-1.5 flex items-center justify-between text-xs text-[#8d96a8]">
              <span>Live Stage Sheet Preview</span>
              <span className="tabular-nums">
                {previewSong.title} · Key {previewSong.key ?? 'C'} ·{' '}
                {previewSong.tempo} BPM
              </span>
            </div>
            <div className="max-h-[520px] flex-1 overflow-y-auto rounded-xl border border-[#1d2331] bg-[#12161f]/60 p-4 space-y-4">
              {previewSong.sections.map((sec, si) => (
                <div key={si} className="space-y-1.5">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#8d96a8]">
                    {sec.label}
                  </div>
                  {sec.lines.map((line, li) => {
                    if (line.type === 'empty')
                      return <div key={li} className="h-2" />;
                    if (line.type === 'comment') {
                      return (
                        <div key={li} className="text-xs italic text-[#6ad3ff]">
                          {line.text}
                        </div>
                      );
                    }
                    return (
                      <div key={li} className="flex flex-wrap">
                        {line.segments.map((seg, gi) => (
                          <div key={gi} className="mr-1.5">
                            <div className="font-mono text-xs font-extrabold text-[#ffae52]">
                              {seg.chord ? transposeChord(seg.chord, 0) : '\u00A0'}
                            </div>
                            <div className="text-sm text-[#f3f5f8]">
                              {seg.lyric || '\u00A0'}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Song Action */}
      {!isNew && onDelete && (
        <div className="mt-3 flex items-center justify-center">
          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="min-h-[44px] px-4 text-sm font-bold text-[#ff5c7a] hover:underline"
            >
              Delete song
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-[#ff5c7a]/40 bg-[#12161f] px-4 py-2">
              <span className="text-xs text-[#f3f5f8]">
                Remove from library and setlists?
              </span>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="min-h-[34px] rounded-lg bg-[#1b212e] px-3 text-xs font-bold text-[#f3f5f8]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="min-h-[34px] rounded-lg bg-[#ff5c7a] px-3 text-xs font-extrabold text-black"
              >
                Confirm Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
