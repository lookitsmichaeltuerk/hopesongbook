import { useMemo, useState } from 'react';
import type { Song } from '../lib/chordpro';
import type { Setlist, SyncStatus } from '../lib/library-store';
import { WhatsNewBanner } from './whats-new-banner';

export type LibraryScreenProps = {
  songs: Song[];
  setlists: Setlist[];
  status: SyncStatus;
  /**
   * Opens a song. When opened from a setlist, `queue` is the setlist's song order so the
   * song screen can step Prev / Next (gig mode).
   */
  onOpen: (song: Song, queue?: { name: string; ids: string[] }) => void;
  onFloat: (song: Song) => void;
  onImport: () => void;
  onNew: () => void;
  onOpenPads?: (song: Song) => void;
  onOpenMelody?: (song: Song) => void;
  onOpenUpdater?: () => void;
};

const STATUS_LABEL: Record<SyncStatus, string> = {
  loading: '◌ loading',
  saved: '☁ saved',
  saving: '☁ saving…',
  offline: '⚠ offline',
};

/**
 * Home screen: scrollable song library with search and setlist filter chips.
 * Tap a song to open it; tap ⧉ to float it over other apps.
 */
export function LibraryScreen({
  songs,
  setlists,
  status,
  onOpen,
  onFloat,
  onImport,
  onNew,
  onOpenPads,
  onOpenMelody,
  onOpenUpdater,
}: LibraryScreenProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const visible = useMemo(() => {
    const list =
      filter === 'all'
        ? [...songs].sort((a, b) => a.title.localeCompare(b.title))
        : (setlists.find((l) => l.id === filter)?.songIds ?? [])
            .map((id) => songs.find((s) => s.id === id))
            .filter((s): s is Song => !!s);
    const q = query.trim().toLowerCase();
    return q
      ? list.filter((s) =>
          `${s.title} ${s.artist ?? ''} ${s.key ?? ''}`
            .toLowerCase()
            .includes(q)
        )
      : list;
  }, [songs, setlists, filter, query]);

  const activeList =
    filter === 'all' ? undefined : setlists.find((l) => l.id === filter);
  const open = (s: Song) =>
    onOpen(
      s,
      activeList
        ? { name: activeList.name, ids: visible.map((v) => v.id) }
        : undefined
    );

  return (
    <div className="flex flex-1 flex-col bg-[#0b0d12]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-5 pt-4 pb-2">
        <div className="min-w-[140px] flex-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#f3f5f8]">
            Library
          </h1>
          <p className="mt-0.5 text-xs text-[#8d96a8] tabular-nums">
            {songs.length} songs · {STATUS_LABEL[status]}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenUpdater && (
            <button
              type="button"
              onClick={onOpenUpdater}
              aria-label="Open APK Auto-Updater"
              className="min-h-[44px] rounded-xl border border-[#283042] bg-[#12161f] px-3.5 text-xs font-bold text-[#4fd18b] transition-colors hover:border-[#4fd18b] whitespace-nowrap shrink-0"
            >
              ⟳ APK Updater
            </button>
          )}

          <button
            type="button"
            onClick={onImport}
            aria-label="Import ChordPro or PDF Lead Sheet"
            className="min-h-[44px] rounded-xl border border-[#283042] bg-[#1b212e] px-3.5 text-sm font-bold text-[#f3f5f8] transition-colors hover:border-[#ff8a1f] whitespace-nowrap shrink-0"
          >
            Import
          </button>

          <button
            type="button"
            onClick={onNew}
            aria-label="New song"
            className="min-h-[44px] min-w-[44px] rounded-xl border border-[#ff8a1f] bg-[#ff8a1f] px-3.5 text-base font-extrabold text-[#111] transition-transform active:scale-95 whitespace-nowrap shrink-0"
          >
            ＋
          </button>
        </div>
      </div>

      <WhatsNewBanner />

      {/* Search & Setlist Filter Bar */}
      <div className="px-5 py-2 space-y-2.5">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs, artists, or keys…"
          className="min-h-[46px] w-full rounded-xl border border-[#1d2331] bg-[#12161f] px-4 text-base text-[#f3f5f8] placeholder-[#8d96a8] focus:border-[#ff8a1f] focus:outline-none"
        />

        <div className="flex gap-2 overflow-x-auto pb-1">
          {[{ id: 'all', name: 'All songs', songIds: [] }, ...setlists].map(
            (item) => {
              const isOn = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`min-h-[38px] rounded-full border px-4 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    isOn
                      ? 'border-[#ff8a1f] bg-[#ff8a1f] text-[#111]'
                      : 'border-[#283042] bg-[#1b212e] text-[#f3f5f8] hover:border-[#ff8a1f]/50'
                  }`}
                >
                  {item.name}
                  {item.id !== 'all' ? ` · ${item.songIds.length}` : ''}
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* Song List */}
      <div className="flex-1 divide-y divide-[#1d2331] px-5 pb-12">
        {visible.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#8d96a8]">
            {query
              ? 'No songs match your search.'
              : 'No songs yet — import a .chordpro / .pdf lead sheet or tap ＋ New.'}
          </div>
        ) : (
          visible.map((item, index) => (
            <div
              key={item.id}
              onClick={() => open(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') open(item);
              }}
              className="group flex min-h-[72px] cursor-pointer items-center gap-3.5 py-3 transition-colors hover:bg-[#12161f]/80 rounded-xl px-2 -mx-2"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ff8a1f]/12 font-mono text-sm font-extrabold text-[#ffae52] tabular-nums">
                {filter === 'all' ? item.key ?? '–' : index + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-bold text-[#f3f5f8] group-hover:text-[#ffae52] transition-colors">
                  {item.title}
                </div>
                <div className="mt-0.5 truncate text-xs text-[#8d96a8] tabular-nums">
                  {[
                    item.artist,
                    item.key && `Key ${item.key}`,
                    `${item.tempo} BPM`,
                    item.time,
                    item.melody && `${item.melody.notes.length} melody notes`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>

              <div
                className="flex items-center gap-2 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {item.melody && onOpenMelody && (
                  <button
                    type="button"
                    onClick={() => onOpenMelody(item)}
                    title={`Open Melody Player for ${item.title}`}
                    className="hidden sm:flex min-h-[44px] items-center justify-center rounded-xl border border-[#283042] bg-[#12161f] px-3 text-xs font-bold text-[#6ad3ff] hover:border-[#6ad3ff] whitespace-nowrap shrink-0"
                  >
                    ♪ Melody
                  </button>
                )}

                {onOpenPads && (
                  <button
                    type="button"
                    onClick={() => onOpenPads(item)}
                    title={`Open Chord & Drum Pads for ${item.title}`}
                    className="hidden sm:flex min-h-[44px] items-center justify-center rounded-xl border border-[#283042] bg-[#12161f] px-3 text-xs font-bold text-[#ffae52] hover:border-[#ff8a1f] whitespace-nowrap shrink-0"
                  >
                    ♫ Pads
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onFloat(item)}
                  aria-label={`Float ${item.title} over other apps`}
                  title="Float songbook & chord pads over other apps"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1b212e] text-lg font-bold text-[#ff8a1f] transition-colors hover:bg-[#ff8a1f] hover:text-[#111]"
                >
                  ⧉
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
