import type { DrumKind, SynthSpec } from '../lib/instruments';

export type BassStyle = 'root' | 'fifth' | 'octave';

type ActiveVoiceGroup = {
  stop: (immediate?: boolean) => void;
};

let audioCtx: AudioContext | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;
const activeGroups = new Map<number, ActiveVoiceGroup[]>();

function getAudioContext(): { ctx: AudioContext; destination: AudioNode } | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;

  if (!audioCtx) {
    audioCtx = new Ctx();
    masterCompressor = audioCtx.createDynamicsCompressor();
    masterCompressor.threshold.value = -16;
    masterCompressor.knee.value = 18;
    masterCompressor.ratio.value = 4;
    masterCompressor.attack.value = 0.004;
    masterCompressor.release.value = 0.18;
    masterCompressor.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return { ctx: audioCtx, destination: masterCompressor || audioCtx.destination };
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function spawnVoice(
  ctx: AudioContext,
  destination: AudioNode,
  midi: number,
  spec: SynthSpec,
  delaySec = 0
): ActiveVoiceGroup {
  const now = ctx.currentTime + delaySec;
  const freq = midiToFreq(midi);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, now);
  const peakGain = Math.min(0.65, Math.max(0.08, spec.gain * 0.36));
  const sustainGain = Math.max(0.001, peakGain * spec.sustain);

  env.gain.linearRampToValueAtTime(peakGain, now + Math.max(0.004, spec.attack));
  env.gain.exponentialRampToValueAtTime(sustainGain, now + Math.max(0.004, spec.attack) + Math.max(0.03, spec.decay));

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  const baseCutoff = Math.min(12000, Math.max(180, spec.cutoff));
  filter.frequency.setValueAtTime(
    spec.wave === 'pluck' ? Math.min(10000, baseCutoff * 2.2) : baseCutoff * 1.4,
    now
  );
  filter.frequency.exponentialRampToValueAtTime(
    baseCutoff,
    now + Math.max(0.04, spec.decay * 0.85)
  );
  filter.Q.value = spec.wave === 'pluck' ? 2.4 : 1.1;

  filter.connect(env);
  env.connect(destination);

  const oscs: OscillatorNode[] = [];

  if (spec.wave === 'epiano') {
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, now);

    mod.type = 'sine';
    mod.frequency.setValueAtTime(freq * (spec.fmRatio ?? 2), now);

    modGain.gain.setValueAtTime(spec.fmDepth ?? 110, now);
    modGain.gain.exponentialRampToValueAtTime(12, now + Math.max(0.12, spec.decay));

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(filter);

    carrier.start(now);
    mod.start(now);
    oscs.push(carrier, mod);
  } else if (spec.wave === 'organ') {
    const drawbars = [1, 2, 3, 4];
    const weights = [0.55, 0.3, 0.15, 0.1];
    drawbars.forEach((mult, idx) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * mult, now);
      o.detune.setValueAtTime((idx - 1.5) * spec.detune, now);
      g.gain.value = weights[idx];
      o.connect(g);
      g.connect(filter);
      o.start(now);
      oscs.push(o);
    });
  } else if (spec.wave === 'pad') {
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'triangle';
    o1.frequency.setValueAtTime(freq, now);
    o2.frequency.setValueAtTime(freq, now);
    o1.detune.setValueAtTime(-spec.detune, now);
    o2.detune.setValueAtTime(spec.detune, now);
    o1.connect(filter);
    o2.connect(filter);
    o1.start(now);
    o2.start(now);
    oscs.push(o1, o2);
  } else if (spec.wave === 'pluck') {
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'triangle';
    o1.frequency.setValueAtTime(freq, now);
    o2.frequency.setValueAtTime(freq * 2, now);
    o1.detune.setValueAtTime(-spec.detune * 0.5, now);
    o2.detune.setValueAtTime(spec.detune * 0.5, now);

    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.35, now);
    g2.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    o1.connect(filter);
    o2.connect(g2);
    g2.connect(filter);
    o1.start(now);
    o2.start(now);
    oscs.push(o1, o2);
  } else {
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = spec.wave;
    o2.type = spec.wave === 'sawtooth' ? 'triangle' : spec.wave;
    o1.frequency.setValueAtTime(freq, now);
    o2.frequency.setValueAtTime(freq, now);
    o1.detune.setValueAtTime(-spec.detune * 0.5, now);
    o2.detune.setValueAtTime(spec.detune * 0.5, now);
    o1.connect(filter);
    o2.connect(filter);
    o1.start(now);
    o2.start(now);
    oscs.push(o1, o2);
  }

  let stopped = false;
  return {
    stop: (immediate = false) => {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      const rel = immediate ? 0.03 : Math.max(0.06, spec.release);
      try {
        env.gain.cancelScheduledValues(t);
        env.gain.setValueAtTime(Math.max(0.0001, env.gain.value), t);
        env.gain.exponentialRampToValueAtTime(0.0001, t + rel);
        oscs.forEach((o) => {
          try {
            o.stop(t + rel + 0.02);
          } catch {
            // ignore already stopped oscillator
          }
        });
      } catch {
        // ignore audio context teardown errors
      }
    },
  };
}

let noiseBuffer: AudioBuffer | null = null;
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const len = ctx.sampleRate * 1.2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buf;
  return buf;
}

export const Synth = {
  playNotes(notes: number[], spec: SynthSpec | null | undefined, group: number) {
    if (!spec || !notes || notes.length === 0) return;
    const engine = getAudioContext();
    if (!engine) return;
    const { ctx, destination } = engine;

    const sorted = [...notes].sort((a, b) => a - b);
    const strumSec = (spec.strumMs ?? 0) / 1000;
    const voices = sorted.map((midi, i) =>
      spawnVoice(ctx, destination, midi, spec, i * strumSec)
    );

    const existing = activeGroups.get(group) || [];
    activeGroups.set(group, [...existing, ...voices]);
  },

  release(group: number) {
    const list = activeGroups.get(group);
    if (!list) return;
    list.forEach((v) => v.stop(false));
    activeGroups.delete(group);
  },

  stopAll() {
    activeGroups.forEach((list) => list.forEach((v) => v.stop(true)));
    activeGroups.clear();
  },

  playDrum(kind: DrumKind | string, volume = 0.9) {
    const engine = getAudioContext();
    if (!engine) return;
    const { ctx, destination } = engine;
    const now = ctx.currentTime;
    const v = Math.min(1, Math.max(0.05, volume));

    if (kind === 'kick') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(145, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.09);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.28);
      gain.gain.setValueAtTime(v * 0.85, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(now);
      osc.stop(now + 0.32);
      return;
    }

    if (kind === 'snare') {
      // Tone body
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.09);
      oscGain.gain.setValueAtTime(v * 0.45, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(oscGain);
      oscGain.connect(destination);
      osc.start(now);
      osc.stop(now + 0.15);

      // Snare wires
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 950;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(v * 0.5, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(destination);
      noise.start(now);
      noise.stop(now + 0.22);
      return;
    }

    if (kind === 'rim') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(840, now);
      osc.frequency.exponentialRampToValueAtTime(380, now + 0.035);
      gain.gain.setValueAtTime(v * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(now);
      osc.stop(now + 0.055);
      return;
    }

    if (kind === 'ch' || kind === 'oh' || kind === 'shaker') {
      const dur = kind === 'oh' ? 0.32 : kind === 'shaker' ? 0.09 : 0.055;
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = kind === 'shaker' ? 'bandpass' : 'highpass';
      filter.frequency.value = kind === 'shaker' ? 5200 : 7200;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(v * 0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(destination);
      noise.start(now);
      noise.stop(now + dur + 0.01);
      return;
    }

    if (kind === 'clap') {
      [0, 0.011, 0.022].forEach((offset, idx) => {
        const noise = ctx.createBufferSource();
        noise.buffer = getNoiseBuffer(ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1400;
        filter.Q.value = 1.6;
        const gain = ctx.createGain();
        const t = now + offset;
        const tail = idx === 2 ? 0.16 : 0.025;
        gain.gain.setValueAtTime(v * 0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + tail);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        noise.start(t);
        noise.stop(t + tail + 0.01);
      });
      return;
    }

    if (kind === 'ltom' || kind === 'htom') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const startF = kind === 'htom' ? 195 : 118;
      const endF = kind === 'htom' ? 105 : 64;
      osc.frequency.setValueAtTime(startF, now);
      osc.frequency.exponentialRampToValueAtTime(endF, now + 0.22);
      gain.gain.setValueAtTime(v * 0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(now);
      osc.stop(now + 0.26);
      return;
    }

    if (kind === 'crash' || kind === 'ride') {
      const dur = kind === 'crash' ? 0.85 : 0.45;
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = kind === 'crash' ? 4800 : 6400;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(v * 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(destination);
      noise.start(now);
      noise.stop(now + dur + 0.02);
      return;
    }

    // Default cowbell
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const gain = ctx.createGain();
    o1.type = 'square';
    o2.type = 'square';
    o1.frequency.setValueAtTime(540, now);
    o2.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(v * 0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    o1.connect(gain);
    o2.connect(gain);
    gain.connect(destination);
    o1.start(now);
    o2.start(now);
    o1.stop(now + 0.15);
    o2.stop(now + 0.15);
  },
};
