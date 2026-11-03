import { useMemo, useState } from 'react';
import {
  type Instrument,
  type InstrumentEra,
  categoriesOf,
  rangeLabel,
} from '../lib/instruments';
import { Synth } from '../modules/songbook-overlay';

const ERA_LABEL = {
  all: 'All',
  modern: 'Modern',
  classic: 'Classic & world',
} as const;

export type InstrumentPickerProps = {
  visible: boolean;
  title: string;
  instruments: Instrument[];
  selectedId: string;
  /** Show the Modern / Classic filter. */
  eraFilter?: boolean;
  /** Show sound-family chips (Pianos, Synths, Mallets...) when instruments have categories. */
  categoryFilter?: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
};

const AUDITION_GROUP = 990002;

/**
 * Bottom sheet modal listing instruments with region, range, search, and Modern/Classic filter.
 * Includes an "Off" row to mute the layer and a live preview audition trigger.
 */
export function InstrumentPicker({
  visible,
  title,
  instruments,
  selectedId,
  eraFilter,
  categoryFilter,
  onSelect,
  onClose,
}: InstrumentPickerProps) {
  const [era, setEra] = useState<'all' | InstrumentEra>('all');
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');

  const cats = useMemo(() => ['All', ...categoriesOf(instruments)], [instruments]);
  const list = useMemo(
    () =>
      instruments.filter(
        (i) =>
          (era === 'all' || i.era === era) &&
          (cat === 'All' || i.category === cat) &&
          (!q ||
            `${i.name} ${i.region} ${i.category ?? ''}`
              .toLowerCase()
              .includes(q.toLowerCase()))
      ),
    [instruments, era, cat, q]
  );

  if (!visible) return null;

  const previewSound = (inst: Instrument) => {
    Synth.release(AUDITION_GROUP);
    const base = Math.max(inst.low, Math.min(inst.high - 12, 60));
    Synth.playNotes([base, base + 4, base + 7], inst.spec, AUDITION_GROUP);
    setTimeout(() => Synth.release(AUDITION_GROUP), 550);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/65 backdrop-blur-xs">
      <button
        type="button"
        aria-label="Close picker"
        onClick={onClose}
        className="flex-1 w-full cursor-default focus:outline-none"
      />
      <div className="mx-auto flex max-h-[80vh] w-full max-w-2xl flex-col rounded-t-2xl border-t border-[#283042] bg-[#12161f] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-lg font-extrabold text-[#f3f5f8]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-3 rounded-lg bg-[#1b212e] text-sm font-semibold text-[#8d96a8] hover:text-[#f3f5f8] whitespace-nowrap shrink-0"
          >
            Done
          </button>
        </div>

        {eraFilter && (
          <>
            <div className="mb-2.5 flex flex-wrap gap-2">
              {(['all', 'modern', 'classic'] as const).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEra(e)}
                  className={`min-h-[38px] rounded-full px-4 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    era === e
                      ? 'bg-[#ff8a1f] text-black'
                      : 'bg-[#1b212e] text-[#f3f5f8] hover:bg-[#252d3d]'
                  }`}
                >
                  {ERA_LABEL[e]}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search (e.g. sitar, koto, Japan, Mali)"
              className="mb-2.5 min-h-[44px] w-full rounded-xl border border-[#1d2331] bg-[#0b0d12] px-3.5 text-sm text-[#f3f5f8] placeholder-[#8d96a8] focus:border-[#ff8a1f] focus:outline-none"
            />
          </>
        )}

        {categoryFilter && cats.length > 2 && (
          <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1">
            {cats.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={`min-h-[38px] rounded-full px-3.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  cat === c
                    ? 'bg-[#ff8a1f] text-black'
                    : 'bg-[#1b212e] text-[#f3f5f8] hover:bg-[#252d3d]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
          {[{ id: 'off' } as Instrument, ...list].map((item) => {
            const on = item.id === selectedId;
            return (
              <div
                key={item.id}
                className={`flex min-h-[56px] items-center justify-between gap-3 rounded-xl px-3.5 py-2 transition-colors ${
                  on
                    ? 'border border-[#ff8a1f] bg-[#1b212e]'
                    : 'border border-transparent hover:bg-[#1b212e]/60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (item.id !== 'off') previewSound(item);
                    onSelect(item.id);
                    onClose();
                  }}
                  className="flex flex-1 items-center justify-between text-left focus:outline-none"
                >
                  {item.id === 'off' ? (
                    <span className="text-base font-semibold text-[#f3f5f8]">
                      Off — mute this layer
                    </span>
                  ) : (
                    <>
                      <div>
                        <div className="text-base font-semibold text-[#f3f5f8]">
                          {item.name}
                        </div>
                        <div className="mt-0.5 text-xs text-[#8d96a8]">
                          {item.region} · {rangeLabel(item)}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-[#8d96a8]">
                        {item.category ??
                          (item.era === 'modern' ? 'Modern' : 'Classic')}
                      </span>
                    </>
                  )}
                </button>
                {item.id !== 'off' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      previewSound(item);
                    }}
                    className="min-h-[36px] rounded-lg border border-[#283042] bg-[#0b0d12] px-2.5 text-xs font-semibold text-[#ffae52] hover:border-[#ff8a1f] whitespace-nowrap shrink-0"
                    title={`Audition ${item.name}`}
                  >
                    ▶ Hear
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
