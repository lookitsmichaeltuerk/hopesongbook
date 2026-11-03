export type PermissionSheetProps = {
  visible: boolean;
  /** True when native Android overlay or interactive web floating mode is available. */
  supported: boolean;
  onGrant: () => void;
  onClose: () => void;
};

/**
 * Explains Android "Display over other apps" permission and offers instant launch
 * into the interactive Floating Songbook Overlay & Practice Backdrop.
 */
export function PermissionSheet({
  visible,
  supported,
  onGrant,
  onClose,
}: PermissionSheetProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/65 backdrop-blur-xs">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 rounded-t-3xl border-t border-[#283042] bg-[#12161f] p-7 shadow-2xl">
        <div className="text-center text-4xl text-[#ff8a1f]">⧉</div>
        <h2 className="text-center text-xl font-extrabold text-[#f3f5f8]">
          {supported ? 'Launch Floating Songbook Overlay' : 'Allow Floating Songbook'}
        </h2>
        <p className="text-center text-sm leading-relaxed text-[#8d96a8]">
          To show your chords, auto-scrolling lyrics, and playable chord pads on
          top of FL Studio Mobile, YouTube, or any other app, Android uses the
          “Display over other apps” (`SYSTEM_ALERT_WINDOW`) service. You can test
          the interactive draggable Floating Overlay right here now.
        </p>
        <button
          type="button"
          onClick={onGrant}
          className="min-h-[50px] w-full rounded-xl border border-[#ff8a1f] bg-[#ff8a1f] text-base font-extrabold text-[#111] transition-transform active:scale-[0.99] whitespace-nowrap shrink-0"
        >
          Launch Floating Overlay
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[50px] w-full rounded-xl border border-[#283042] bg-[#1b212e] text-base font-bold text-[#f3f5f8] hover:bg-[#242c3d] whitespace-nowrap shrink-0"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
