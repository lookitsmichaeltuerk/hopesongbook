import { useEffect, useState } from 'react';

export const APP_VERSION = '2.4.0';

export type UpdaterModalProps = {
  visible: boolean;
  onClose: () => void;
  autoUpdateOnStartup: boolean;
  onToggleAutoUpdate: (enabled: boolean) => void;
  lastChecked: string | null;
  updateState: 'idle' | 'checking' | 'up-to-date' | 'updating' | 'error';
  onCheckNow: () => void;
};

export function UpdaterModal({
  visible,
  onClose,
  autoUpdateOnStartup,
  onToggleAutoUpdate,
  lastChecked,
  updateState,
  onCheckNow,
}: UpdaterModalProps) {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!copiedCmd) return undefined;
    const t = setTimeout(() => setCopiedCmd(null), 2000);
    return () => clearTimeout(t);
  }, [copiedCmd]);

  if (!visible) return null;

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCmd(id);
    } catch {
      // ignore
    }
  };

  const downloadExpoIndexFile = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/expo-index.tsx');
      const content = await res.text();
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'index.tsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setDownloading(false);
    }
  };

  const termuxCopyDownloadedCmd = `cd ~/hope-songbook
npx expo install react-native-webview expo-updates
cp ~/storage/downloads/index.tsx src/app/index.tsx
EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 eas build --platform android --profile preview`;

  const termuxOtaPushCmd = `cd ~/hope-songbook
cp ~/storage/downloads/index.tsx src/app/index.tsx
EAS_NO_VCS=1 eas update --branch preview --message "Update Hope Songbook"`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-xs sm:justify-center sm:p-4">
      <div className="mx-auto flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-[#283042] bg-[#12161f] shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1d2331] bg-[#1b212e] px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-[#f3f5f8]">
              OTA Auto-Updater & Android APK Sync
            </h2>
            <p className="text-xs text-[#8d96a8] tabular-nums">
              Version {APP_VERSION} · Exact Web + Android Parity & Startup Updates
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] rounded-xl bg-[#12161f] px-3.5 text-xs font-bold text-[#8d96a8] hover:text-[#f3f5f8]"
          >
            Close
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Startup Auto-Updater Status Card */}
          <div className="rounded-xl border border-[#283042] bg-[#0b0d12] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-[#f3f5f8]">
                  Automatic Startup Update Check
                </div>
                <div className="text-xs text-[#8d96a8] tabular-nums">
                  {updateState === 'checking' && '◌ Checking for updates now…'}
                  {updateState === 'updating' && '↓ Downloading new bundle & reloading…'}
                  {updateState === 'up-to-date' &&
                    `✓ Up to date (v${APP_VERSION})${lastChecked ? ` · Checked ${lastChecked}` : ''}`}
                  {updateState === 'idle' &&
                    `Ready · Checks automatically every time the app opens`}
                  {updateState === 'error' &&
                    `Offline mode active · Using cached local v${APP_VERSION} bundle`}
                </div>
              </div>

              <button
                type="button"
                onClick={onCheckNow}
                disabled={updateState === 'checking' || updateState === 'updating'}
                className="min-h-[40px] rounded-xl bg-[#ff8a1f] px-4 text-xs font-extrabold text-[#111] transition-transform active:scale-95 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {updateState === 'checking' ? 'Checking…' : 'Check for Updates'}
              </button>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={autoUpdateOnStartup}
              onClick={() => onToggleAutoUpdate(!autoUpdateOnStartup)}
              className="flex min-h-[40px] w-full items-center justify-between rounded-lg border border-[#1d2331] bg-[#12161f] px-3.5 py-2 text-left"
            >
              <span className="text-xs font-semibold text-[#f3f5f8]">
                Check & install updates automatically on app startup (`ON_LOAD`)
              </span>
              <span
                className={`font-mono text-xs font-extrabold ${
                  autoUpdateOnStartup ? 'text-[#4fd18b]' : 'text-[#8d96a8]'
                }`}
              >
                {autoUpdateOnStartup ? 'ENABLED' : 'OFF'}
              </span>
            </button>
          </div>

          {/* Step 1: Download Exact Synced Bundle */}
          <div className="rounded-xl border border-[#283042] bg-[#0b0d12] p-4 space-y-3">
            <div className="text-sm font-bold text-[#ffae52]">
              1. Get the Exact Preview App + Auto-Updater into Your APK
            </div>
            <p className="text-xs leading-relaxed text-[#8d96a8]">
              Tap below to download the compiled <code className="text-[#f3f5f8]">index.tsx</code>{' '}
              file to your phone’s Downloads folder. It embeds this exact full app
              (all 3 instrument layers, world strings, drum sequencer, piano-roll
              melody player, floating overlay) plus the automatic startup updater.
            </p>
            <button
              type="button"
              onClick={downloadExpoIndexFile}
              disabled={downloading}
              className="min-h-[46px] w-full rounded-xl border border-[#ff8a1f] bg-[#ff8a1f] text-sm font-extrabold text-[#111] transition-transform active:scale-[0.99] disabled:opacity-50"
            >
              {downloading
                ? 'Packaging Full App Bundle…'
                : '⬇ Download Full Synced index.tsx to Phone'}
            </button>
          </div>

          {/* Step 2: Copy into Termux & Enable EAS Auto-Updates */}
          <div className="rounded-xl border border-[#283042] bg-[#0b0d12] p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-[#6ad3ff]">
                2. One-Time APK Build with Auto-Updater Enabled
              </span>
              <button
                type="button"
                onClick={() => copyText(termuxCopyDownloadedCmd, 'build')}
                className="min-h-[34px] rounded-lg border border-[#283042] bg-[#1b212e] px-3 text-xs font-bold text-[#f3f5f8] hover:border-[#ff8a1f] whitespace-nowrap shrink-0"
              >
                {copiedCmd === 'build' ? '✓ Copied' : '⧉ Copy Command'}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-[#1d2331] bg-[#12161f] p-3 font-mono text-xs text-[#f3f5f8]">
              {termuxCopyDownloadedCmd}
            </pre>
          </div>

          {/* Step 3: Instant Future OTA Updates without Rebuilding APK */}
          <div className="rounded-xl border border-[#283042] bg-[#0b0d12] p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-[#4fd18b]">
                3. Future Updates (5 Seconds — No APK Rebuild Needed!)
              </span>
              <button
                type="button"
                onClick={() => copyText(termuxOtaPushCmd, 'ota')}
                className="min-h-[34px] rounded-lg border border-[#283042] bg-[#1b212e] px-3 text-xs font-bold text-[#f3f5f8] hover:border-[#4fd18b] whitespace-nowrap shrink-0"
              >
                {copiedCmd === 'ota' ? '✓ Copied' : '⧉ Copy OTA Command'}
              </button>
            </div>
            <p className="text-xs text-[#8d96a8]">
              Once the APK above is installed, you never have to rebuild or
              reinstall the APK again. Just run <code className="text-[#f3f5f8]">eas update</code> and
              your phone app will automatically download and apply the update on
              startup:
            </p>
            <pre className="overflow-x-auto rounded-lg border border-[#1d2331] bg-[#12161f] p-3 font-mono text-xs text-[#f3f5f8]">
              {termuxOtaPushCmd}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
