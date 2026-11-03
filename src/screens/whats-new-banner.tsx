import { useState } from 'react';

export function WhatsNewBanner() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hope_whats_new_v2') === '1';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('hope_whats_new_v2', '1');
    } catch {
      // ignore
    }
  };

  return (
    <div className="mx-5 my-2 flex items-center justify-between gap-4 rounded-xl border border-[#283042] bg-[#12161f] px-4 py-3">
      <div className="text-xs leading-relaxed text-[#f3f5f8]">
        <span className="font-bold text-[#ffae52]">Stage & Studio Ready:</span>{' '}
        Import <span className="text-[#6ad3ff]">.chordpro</span> or{' '}
        <span className="text-[#6ad3ff]">PDF Lead Sheets</span>, play 3-layer
        Keys + World Strings + Left-Hand Bass pads, or tap{' '}
        <span className="font-bold text-[#ff8a1f]">⧉</span> to float lyrics &
        pads over your DAW or practice video.
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss banner"
        className="min-h-[36px] min-w-[36px] rounded-lg px-2 text-xs font-semibold text-[#8d96a8] hover:bg-[#1b212e] hover:text-[#f3f5f8] whitespace-nowrap shrink-0"
      >
        Got it
      </button>
    </div>
  );
}
