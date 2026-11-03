import { useEffect, useRef, useState } from 'react';
import type { DrumKind, GrooveDef } from './instruments';
import { Synth } from '../modules/songbook-overlay';

export function useDrumLoop(groove: GrooveDef, bpm: number) {
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState<number>(-1);
  const stepRef = useRef<number>(0);

  useEffect(() => {
    if (!playing) {
      setStep(-1);
      stepRef.current = 0;
      return undefined;
    }

    const sixteenthMs = Math.max(40, (60000 / Math.max(30, bpm)) / 4);

    const triggerStep = (idx: number) => {
      setStep(idx);
      for (const [kind, pattern] of Object.entries(groove.rows)) {
        if (!pattern) continue;
        const ch = pattern[idx % pattern.length];
        if (ch === 'X') {
          Synth.playDrum(kind as DrumKind, 0.95);
        } else if (ch === 'x') {
          Synth.playDrum(kind as DrumKind, 0.65);
        }
      }
    };

    triggerStep(stepRef.current);
    stepRef.current = (stepRef.current + 1) % 16;

    const timer = setInterval(() => {
      triggerStep(stepRef.current);
      stepRef.current = (stepRef.current + 1) % 16;
    }, sixteenthMs);

    return () => clearInterval(timer);
  }, [playing, groove, bpm]);

  const toggle = () => setPlaying((p) => !p);
  const stop = () => setPlaying(false);

  return {
    playing,
    step,
    toggle,
    stop,
  };
}
