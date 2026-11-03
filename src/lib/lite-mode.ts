import { useState } from 'react';
import type { SynthSpec } from './instruments';

export const LITE_MELODY_SPEC: SynthSpec = {
  wave: 'triangle',
  attack: 0.01,
  decay: 0.35,
  sustain: 0.35,
  release: 0.2,
  cutoff: 2200,
  detune: 0,
  gain: 0.55,
};

export const LITE_CHORD_SPEC: SynthSpec = {
  wave: 'sine',
  attack: 0.015,
  decay: 0.4,
  sustain: 0.3,
  release: 0.25,
  cutoff: 1600,
  detune: 0,
  gain: 0.35,
};

export function useLiteMode(): [boolean, (next: boolean) => void] {
  const [lite, setLiteState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hope_songbook_lite_mode') === '1';
    } catch {
      return false;
    }
  });

  const setLite = (next: boolean) => {
    setLiteState(next);
    try {
      localStorage.setItem('hope_songbook_lite_mode', next ? '1' : '0');
    } catch {
      // ignore storage errors
    }
  };

  return [lite, setLite];
}
