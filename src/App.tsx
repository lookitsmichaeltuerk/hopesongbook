import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  NEW_SONG_TEMPLATE,
  parseChordPro,
  type Song,
  type SongMelody,
} from './lib/chordpro';
import {
  INITIAL_SETLISTS,
  INITIAL_SONGS,
  type Setlist,
  type SyncStatus,
} from './lib/library-store';
import {
  DEFAULT_PAD_SETTINGS,
  type PadSettings,
} from './lib/pad-settings';
import {
  BASS_INSTRUMENTS,
  KEY_INSTRUMENTS,
  STRING_INSTRUMENTS,
} from './lib/instruments';
import {
  generateMelodyForChordPro,
  importSongFromFile,
} from './lib/importer';
import { Synth } from './modules/songbook-overlay';

import { LibraryScreen } from './screens/library-screen';
import { SongScreen } from './screens/song-screen';
import { PadsScreen } from './screens/pads-screen';
import { MelodyScreen } from './screens/melody-screen';
import { EditorScreen } from './screens/editor-screen';
import { PermissionSheet } from './screens/permission-sheet';
import { FloatingOverlay } from './screens/floating-overlay';
import { APP_VERSION, UpdaterModal } from './screens/updater-modal';

type Screen = 'library' | 'song' | 'pads' | 'melody' | 'editor';

const STORAGE_SONGS_KEY = 'hope_songbook_songs_v2';
const STORAGE_PADS_KEY = 'hope_songbook_pads_v2';
const STORAGE_AUTO_UPDATE_KEY = 'hope_songbook_auto_update_v1';

export default function App() {
  const [screen, setScreen] = useState<Screen>('library');
  const [songs, setSongs] = useState<Song[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SONGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback to initial songs
    }
    return INITIAL_SONGS;
  });

  const [setlists] = useState<Setlist[]>(INITIAL_SETLISTS);
  const [status, setStatus] = useState<SyncStatus>('saved');

  const [currentSongId, setCurrentSongId] = useState<string>(
    () => INITIAL_SONGS[0].id
  );
  const [editingNew, setEditingNew] = useState<boolean>(false);
  const [importedDraft, setImportedDraft] = useState<{
    raw: string;
    melody?: SongMelody;
  } | null>(null);

  const [transpose, setTranspose] = useState<number>(0);
  const [bpm, setBpm] = useState<number>(INITIAL_SONGS[0].tempo);
  const [gigQueue, setGigQueue] = useState<
    { name: string; ids: string[] } | undefined
  >(undefined);

  const [padSettings, setPadSettings] = useState<PadSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PADS_KEY);
      if (saved) return { ...DEFAULT_PAD_SETTINGS, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return DEFAULT_PAD_SETTINGS;
  });

  const [floatingSong, setFloatingSong] = useState<Song | null>(null);
  const [permSheetSong, setPermSheetSong] = useState<Song | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [generatingMelody, setGeneratingMelody] = useState<boolean>(false);

  // Automatic Startup Updater State
  const [updaterVisible, setUpdaterVisible] = useState<boolean>(false);
  const [autoUpdateOnStartup, setAutoUpdateOnStartup] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_AUTO_UPDATE_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const [updateState, setUpdateState] = useState<
    'idle' | 'checking' | 'up-to-date' | 'updating' | 'error'
  >('idle');
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSong = useMemo(
    () => songs.find((s) => s.id === currentSongId) ?? songs[0] ?? null,
    [songs, currentSongId]
  );

  const keysInst = useMemo(
    () => KEY_INSTRUMENTS.find((i) => i.id === padSettings.keysId),
    [padSettings.keysId]
  );
  const bassInst = useMemo(
    () => BASS_INSTRUMENTS.find((i) => i.id === padSettings.bassId),
    [padSettings.bassId]
  );
  const stringsInst = useMemo(
    () => STRING_INSTRUMENTS.find((i) => i.id === padSettings.stringsId),
    [padSettings.stringsId]
  );

  const checkForUpdates = async () => {
    setUpdateState('checking');
    try {
      const res = await fetch('/api/ota-version');
      if (!res.ok) throw new Error('Offline');
      const data = await res.json();
      setLastChecked(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      if (data.version && data.version !== APP_VERSION) {
        setUpdateState('updating');
        setTimeout(() => {
          window.location.reload();
        }, 700);
      } else {
        setUpdateState('up-to-date');
      }
    } catch {
      setUpdateState('up-to-date');
      setLastChecked(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  };

  // Run automatic update check on startup
  useEffect(() => {
    if (autoUpdateOnStartup) {
      checkForUpdates();
    }
  }, []);

  const handleToggleAutoUpdate = (enabled: boolean) => {
    setAutoUpdateOnStartup(enabled);
    try {
      localStorage.setItem(STORAGE_AUTO_UPDATE_KEY, enabled ? '1' : '0');
    } catch {
      // ignore
    }
  };

  // Persist songs to localStorage
  useEffect(() => {
    setStatus('saving');
    try {
      localStorage.setItem(STORAGE_SONGS_KEY, JSON.stringify(songs));
      const t = setTimeout(() => setStatus('saved'), 250);
      return () => clearTimeout(t);
    } catch {
      setStatus('offline');
      return undefined;
    }
  }, [songs]);

  // Persist pad settings
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PADS_KEY, JSON.stringify(padSettings));
    } catch {
      // ignore
    }
  }, [padSettings]);

  const openSong = (
    song: Song,
    queue?: { name: string; ids: string[] },
    targetScreen: Screen = 'song'
  ) => {
    Synth.stopAll();
    setCurrentSongId(song.id);
    setTranspose(0);
    setBpm(song.tempo || 100);
    setGigQueue(queue);
    setEditingNew(false);
    setImportedDraft(null);
    setScreen(targetScreen);
  };

  const handleRequestFloat = (song: Song) => {
    const alreadyGranted = sessionStorage.getItem('hope_overlay_granted') === '1';
    if (alreadyGranted) {
      setFloatingSong(song);
    } else {
      setPermSheetSong(song);
    }
  };

  const handleGrantFloat = () => {
    sessionStorage.setItem('hope_overlay_granted', '1');
    if (permSheetSong) {
      setFloatingSong(permSheetSong);
    }
    setPermSheetSong(null);
  };

  const triggerFilePicker = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportError(null);
    setImportStatus(`Importing "${file.name}"…`);
    try {
      const imported = await importSongFromFile(file, (msg) =>
        setImportStatus(msg)
      );
      setImportStatus(null);

      if (screen === 'editor') {
        setImportedDraft({ raw: imported.raw, melody: imported.melody });
      } else {
        setSongs((prev) => [imported, ...prev]);
        openSong(imported, undefined, 'song');
      }
    } catch (err: any) {
      setImportStatus(null);
      setImportError(err?.message || 'Failed to import file.');
    }
  };

  const handleSaveEditor = (source: string, melody?: SongMelody) => {
    const id = editingNew || !currentSong ? `song_${Date.now()}` : currentSong.id;
    const parsed = parseChordPro(
      source,
      id,
      melody ?? (!editingNew ? currentSong?.melody : undefined)
    );

    setSongs((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = parsed;
        return copy;
      }
      return [parsed, ...prev];
    });

    setCurrentSongId(parsed.id);
    setBpm(parsed.tempo || 100);
    setEditingNew(false);
    setImportedDraft(null);
    setScreen('song');
  };

  const handleDeleteSong = () => {
    if (!currentSong) return;
    const next = songs.filter((s) => s.id !== currentSong.id);
    setSongs(next);
    if (next.length > 0) {
      setCurrentSongId(next[0].id);
    }
    setEditingNew(false);
    setScreen('library');
  };

  const handleGenerateMelodyForCurrent = async () => {
    if (!currentSong || generatingMelody) return;
    setGeneratingMelody(true);
    setImportError(null);
    try {
      const melody = await generateMelodyForChordPro(currentSong.raw);
      if (melody) {
        const updated: Song = { ...currentSong, melody };
        setSongs((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        );
        setScreen('melody');
      }
    } catch (err: any) {
      setImportError(err?.message || 'Could not generate lead melody.');
    } finally {
      setGeneratingMelody(false);
    }
  };

  // Compute gig mode setlist navigation props
  const setlistNav = useMemo(() => {
    if (!gigQueue || !currentSong) return undefined;
    const idx = gigQueue.ids.indexOf(currentSong.id);
    if (idx === -1) return undefined;
    const prevSong =
      idx > 0 ? songs.find((s) => s.id === gigQueue.ids[idx - 1]) : undefined;
    const nextSong =
      idx < gigQueue.ids.length - 1
        ? songs.find((s) => s.id === gigQueue.ids[idx + 1])
        : undefined;

    return {
      name: gigQueue.name,
      index: idx,
      total: gigQueue.ids.length,
      onPrev: prevSong ? () => openSong(prevSong, gigQueue, 'song') : undefined,
      onNext: nextSong ? () => openSong(nextSong, gigQueue, 'song') : undefined,
    };
  }, [gigQueue, currentSong, songs]);

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0d12] text-[#f3f5f8]">
      {/* Hidden File Input for ChordPro & PDF Lead Sheets */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".chordpro,.cho,.pro,.chopro,.txt,.pdf,application/pdf,text/plain,image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 border-b border-[#1d2331] bg-[#0b0d12]/95 px-5 py-3 backdrop-blur-md">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => {
            Synth.stopAll();
            setScreen('library');
          }}
          className="text-lg font-extrabold tracking-tight text-[#f3f5f8] hover:text-[#ffae52] transition-colors whitespace-nowrap shrink-0 focus:outline-none"
        >
          Hope Songbook
        </button>

        {/* Zone 2: Concise Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#8d96a8]">
          <button
            type="button"
            onClick={() => {
              Synth.stopAll();
              setScreen('library');
            }}
            className={`hover:text-[#f3f5f8] transition-colors whitespace-nowrap shrink-0 ${
              screen === 'library'
                ? 'text-[#ffae52] underline underline-offset-8 decoration-2'
                : ''
            }`}
          >
            Library
          </button>

          {currentSong && (
            <>
              <button
                type="button"
                onClick={() => {
                  Synth.stopAll();
                  setScreen('song');
                }}
                className={`hover:text-[#f3f5f8] transition-colors whitespace-nowrap shrink-0 ${
                  screen === 'song'
                    ? 'text-[#ffae52] underline underline-offset-8 decoration-2'
                    : ''
                }`}
              >
                Song Sheet
              </button>

              <button
                type="button"
                onClick={() => {
                  Synth.stopAll();
                  setScreen('pads');
                }}
                className={`hover:text-[#f3f5f8] transition-colors whitespace-nowrap shrink-0 ${
                  screen === 'pads'
                    ? 'text-[#ffae52] underline underline-offset-8 decoration-2'
                    : ''
                }`}
              >
                Chord & Drum Pads
              </button>

              <button
                type="button"
                onClick={() => {
                  Synth.stopAll();
                  if (currentSong.melody) {
                    setScreen('melody');
                  } else {
                    handleGenerateMelodyForCurrent();
                  }
                }}
                className={`hover:text-[#f3f5f8] transition-colors whitespace-nowrap shrink-0 ${
                  screen === 'melody'
                    ? 'text-[#ffae52] underline underline-offset-8 decoration-2'
                    : ''
                }`}
              >
                Melody Player
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setUpdaterVisible(true)}
            className="hover:text-[#4fd18b] transition-colors whitespace-nowrap shrink-0"
          >
            APK Updater
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={triggerFilePicker}
            className="min-h-[40px] rounded-xl bg-[#ff8a1f] px-4 py-2 text-xs font-extrabold text-[#111] transition-transform active:scale-95 whitespace-nowrap shrink-0"
          >
            Import Lead Sheet
          </button>
        </div>
      </header>

      {/* Import Progress / Error Feedback Bar */}
      {(importStatus || importError) && (
        <div
          className={`flex items-center justify-between gap-3 border-b px-5 py-2.5 text-xs font-semibold ${
            importError
              ? 'border-[#ff5c7a]/40 bg-[#ff5c7a]/15 text-[#ff5c7a]'
              : 'border-[#6ad3ff]/40 bg-[#6ad3ff]/12 text-[#6ad3ff]'
          }`}
        >
          <span>{importError || importStatus}</span>
          {importError && (
            <button
              type="button"
              onClick={() => setImportError(null)}
              className="rounded px-2 py-0.5 text-xs font-bold hover:bg-black/20"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Main Screen Container */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
        {screen === 'library' && (
          <LibraryScreen
            songs={songs}
            setlists={setlists}
            status={status}
            onOpen={(song, queue) => openSong(song, queue, 'song')}
            onOpenPads={(song) => openSong(song, undefined, 'pads')}
            onOpenMelody={(song) => openSong(song, undefined, 'melody')}
            onOpenUpdater={() => setUpdaterVisible(true)}
            onFloat={handleRequestFloat}
            onImport={triggerFilePicker}
            onNew={() => {
              Synth.stopAll();
              setEditingNew(true);
              setImportedDraft(null);
              setScreen('editor');
            }}
          />
        )}

        {screen === 'song' && currentSong && (
          <SongScreen
            song={currentSong}
            transpose={transpose}
            bpm={bpm}
            keys={keysInst}
            strings={stringsInst}
            onTranspose={setTranspose}
            onBpm={setBpm}
            onBack={() => setScreen('library')}
            onFloat={() => handleRequestFloat(currentSong)}
            onEdit={() => {
              setEditingNew(false);
              setImportedDraft(null);
              setScreen('editor');
            }}
            onPads={() => setScreen('pads')}
            onMelody={
              currentSong.melody ? () => setScreen('melody') : undefined
            }
            onGenerateMelody={handleGenerateMelodyForCurrent}
            generatingMelody={generatingMelody}
            setlist={setlistNav}
          />
        )}

        {screen === 'pads' && currentSong && (
          <PadsScreen
            song={currentSong}
            transpose={transpose}
            bpm={bpm}
            settings={padSettings}
            keys={keysInst}
            bass={bassInst}
            strings={stringsInst}
            onSettings={(patch) =>
              setPadSettings((prev) => ({ ...prev, ...patch }))
            }
            onBack={() => setScreen('song')}
            onFloat={() => handleRequestFloat(currentSong)}
          />
        )}

        {screen === 'melody' && currentSong && currentSong.melody && (
          <MelodyScreen
            song={currentSong}
            transpose={transpose}
            bpm={bpm}
            keys={keysInst}
            octave={padSettings.octave}
            onBpm={setBpm}
            onBack={() => setScreen('song')}
          />
        )}

        {screen === 'editor' && (
          <EditorScreen
            key={
              importedDraft
                ? `draft_${importedDraft.raw.length}`
                : editingNew
                ? 'new_song'
                : currentSong?.id ?? 'editor'
            }
            initial={
              importedDraft
                ? importedDraft.raw
                : editingNew || !currentSong
                ? NEW_SONG_TEMPLATE
                : currentSong.raw
            }
            initialMelody={
              importedDraft
                ? importedDraft.melody
                : editingNew || !currentSong
                ? undefined
                : currentSong.melody
            }
            isNew={editingNew || !currentSong}
            onSave={handleSaveEditor}
            onCancel={() =>
              setScreen(editingNew || !currentSong ? 'library' : 'song')
            }
            onDelete={
              !editingNew && currentSong ? handleDeleteSong : undefined
            }
            onImportFile={triggerFilePicker}
          />
        )}
      </main>

      {/* Permission Explainer Sheet */}
      <PermissionSheet
        visible={!!permSheetSong}
        supported={true}
        onGrant={handleGrantFloat}
        onClose={() => setPermSheetSong(null)}
      />

      {/* OTA Updater & Android APK Export Modal */}
      <UpdaterModal
        visible={updaterVisible}
        onClose={() => setUpdaterVisible(false)}
        autoUpdateOnStartup={autoUpdateOnStartup}
        onToggleAutoUpdate={handleToggleAutoUpdate}
        lastChecked={lastChecked}
        updateState={updateState}
        onCheckNow={checkForUpdates}
      />

      {/* Interactive Draggable Floating Songbook & Pads Overlay */}
      {floatingSong && (
        <FloatingOverlay
          song={floatingSong}
          transpose={transpose}
          bpm={bpm}
          settings={padSettings}
          keys={keysInst}
          strings={stringsInst}
          bass={bassInst}
          onTranspose={setTranspose}
          onBpm={setBpm}
          onClose={() => setFloatingSong(null)}
          onExpandToApp={() => {
            const target = floatingSong;
            setFloatingSong(null);
            openSong(target, undefined, 'song');
          }}
        />
      )}
    </div>
  );
}
