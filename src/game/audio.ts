export type EngineAudio = {
  unlock: () => void;
  update: (speed: number, throttle: number, alive: boolean) => void;
  launch: () => void;
  land: (grade: string) => void;
  crash: () => void;
  finish: () => void;
  setMuted: (m: boolean) => void;
};

export function createAudio(): EngineAudio {
  let ctx: AudioContext | null = null;
  let osc: OscillatorNode | null = null;
  let filter: BiquadFilterNode | null = null;
  let gain: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let muted = false;

  function context() {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      osc = ctx.createOscillator();
      osc.type = "sawtooth";
      filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 320;
      gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      const len = ctx.sampleRate * 0.4;
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }

  function burst(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(40, freq + slide), ctx.currentTime + dur);
    g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  function noiseBurst(dur: number, vol: number, freq: number) {
    if (!ctx || !noise || muted) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(f);
    f.connect(g);
    g.connect(ctx.destination);
    src.start();
    src.stop(ctx.currentTime + dur);
  }

  return {
    unlock() {
      context();
    },
    setMuted(m: boolean) {
      muted = m;
      if (gain && ctx) gain.gain.setTargetAtTime(m ? 0 : gain.gain.value, ctx.currentTime, 0.03);
    },
    update(speed: number, throttle: number, alive: boolean) {
      if (!ctx || !osc || !gain || !filter || muted || !alive) {
        if (gain && ctx && (!alive || muted)) gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
        return;
      }
      const rpm = 48 + Math.abs(speed) * 0.16 + throttle * 36;
      osc.frequency.setTargetAtTime(rpm, ctx.currentTime, 0.06);
      filter.frequency.setTargetAtTime(280 + throttle * 500 + Math.abs(speed) * 0.25, ctx.currentTime, 0.06);
      const vol = 0.018 + throttle * 0.03 + Math.min(0.02, Math.abs(speed) / 50000);
      gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.05);
    },
    launch() {
      context();
      noiseBurst(0.12, 0.08, 900);
    },
    land(grade: string) {
      context();
      if (grade === "perfect") {
        burst(520, 0.12, "square", 0.06);
        burst(780, 0.16, "square", 0.045);
      } else if (grade === "good") {
        burst(360, 0.1, "square", 0.05);
      } else {
        noiseBurst(0.14, 0.09, 240);
      }
    },
    crash() {
      context();
      noiseBurst(0.28, 0.16, 180);
      burst(140, 0.3, "sawtooth", 0.07, -80);
    },
    finish() {
      context();
      burst(440, 0.12, "square", 0.06);
      window.setTimeout(() => burst(660, 0.16, "square", 0.055), 90);
      window.setTimeout(() => burst(880, 0.2, "square", 0.05), 180);
    },
  };
}
