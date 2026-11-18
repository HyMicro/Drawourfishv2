/**
 * Tiny procedural sound kit — no audio files, fully offline-friendly.
 * All sounds are synthesised with the Web Audio API.
 */

type NoiseSource = { source: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode };

class SoundKit {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private noise: NoiseSource | null = null;
  private muted = false;
  private unlocked = false;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private delay: DelayNode | null = null;

  get isMuted() {
    return this.muted;
  }

  unlock() {
    this.ensure();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (!this.unlocked) {
      this.unlocked = true;
      this.startMusic();
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.08);
    }
    if (!muted) this.unlock();
  }

  private ensure() {
    if (this.ctx) return;
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(ctx.destination);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.6;
    this.sfx.connect(this.master);

    this.music = ctx.createGain();
    this.music.gain.value = 0.32;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 2600;
    this.music.connect(lowpass);
    lowpass.connect(this.master);

    // Soft underwater echo for chimes.
    this.delay = ctx.createDelay(0.5);
    this.delay.delayTime.value = 0.18;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.22;
    const wet = ctx.createGain();
    wet.gain.value = 0.18;
    this.delay.connect(feedback);
    feedback.connect(this.delay);
    this.delay.connect(wet);
    wet.connect(this.sfx);
  }

  private now() {
    return this.ctx?.currentTime ?? 0;
  }

  private tone(
    freq: number,
    duration: number,
    options: {
      type?: OscillatorType;
      gain?: number;
      slideTo?: number;
      delay?: number;
      attack?: number;
      destination?: AudioNode;
    } = {},
  ) {
    this.ensure();
    const ctx = this.ctx;
    if (!ctx || !this.sfx || !this.master) return;
    const t0 = this.now() + (options.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = options.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (options.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, options.slideTo), t0 + duration);
    }
    const peak = options.gain ?? 0.18;
    const attack = options.attack ?? 0.008;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(options.destination ?? this.sfx);
    if (this.delay) gain.connect(this.delay);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  chime(kind: 'soft' | 'bright' = 'soft') {
    if (!this.unlocked) return;
    const base = kind === 'bright' ? 1046 : 784;
    this.tone(base, 0.45, { type: 'sine', gain: 0.11 });
    this.tone(base * 1.5, 0.5, { type: 'triangle', gain: 0.045, delay: 0.035 });
    this.tone(base * 2, 0.35, { type: 'sine', gain: 0.025, delay: 0.08 });
  }

  pop() {
    if (!this.unlocked) return;
    this.tone(220, 0.12, { type: 'sine', gain: 0.14, slideTo: 620 });
  }

  splash() {
    if (!this.unlocked) return;
    this.ensure();
    const ctx = this.ctx;
    if (!ctx || !this.sfx) return;
    const t0 = this.now();
    const length = Math.floor(ctx.sampleRate * 0.45);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 1.7);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t0);
    filter.frequency.exponentialRampToValueAtTime(360, t0 + 0.4);
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.42);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfx);
    src.start(t0);
  }

  munch() {
    if (!this.unlocked) return;
    this.tone(180, 0.09, { type: 'square', gain: 0.05, slideTo: 90 });
    this.tone(130, 0.14, { type: 'triangle', gain: 0.08, slideTo: 70, delay: 0.07 });
  }

  shutter() {
    if (!this.unlocked) return;
    this.tone(1400, 0.05, { type: 'square', gain: 0.04 });
    this.tone(900, 0.08, { type: 'square', gain: 0.03, delay: 0.06 });
    this.tone(2000, 0.1, { type: 'sine', gain: 0.03, delay: 0.12 });
  }

  emote() {
    if (!this.unlocked) return;
    this.tone(880, 0.22, { type: 'sine', gain: 0.08, slideTo: 1180 });
    this.tone(1320, 0.3, { type: 'sine', gain: 0.04, delay: 0.06 });
  }

  brushStart() {
    if (!this.unlocked) return;
    this.ensure();
    const ctx = this.ctx;
    if (!ctx || !this.sfx) return;
    if (this.noise) return;
    const length = Math.floor(ctx.sampleRate * 1.2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.03 * white) / 1.03;
      data[i] = last * 3 + white * 0.12;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfx);
    source.start();
    this.noise = { source, filter, gain };
  }

  brushMove(speed: number) {
    if (!this.ctx || !this.noise) return;
    const t = this.ctx.currentTime;
    const clamped = Math.min(1, Math.max(0, speed));
    this.noise.gain.gain.setTargetAtTime(0.008 + clamped * 0.045, t, 0.05);
    this.noise.filter.frequency.setTargetAtTime(500 + clamped * 1600, t, 0.08);
  }

  brushStop() {
    if (!this.ctx || !this.noise) return;
    const t = this.ctx.currentTime;
    this.noise.gain.gain.setTargetAtTime(0.0001, t, 0.06);
    const source = this.noise.source;
    this.noise = null;
    window.setTimeout(() => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // already stopped
      }
    }, 220);
  }

  private startMusic() {
    if (this.musicTimer !== null || !this.ctx) return;
    const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
    const schedule = () => {
      if (!this.ctx || this.muted) {
        this.musicTimer = window.setTimeout(schedule, 1800);
        return;
      }
      this.musicStep += 1;
      const note = notes[Math.floor(Math.random() * notes.length)];
      const octave = Math.random() > 0.7 ? 2 : 1;
      this.tone(note * octave, 1.4, {
        type: 'sine',
        gain: 0.045,
        attack: 0.02,
        destination: this.music ?? undefined,
      });
      this.tone(note * 2.01, 0.9, {
        type: 'triangle',
        gain: 0.012,
        delay: 0.04,
        destination: this.music ?? undefined,
      });
      if (this.musicStep % 4 === 0) {
        this.tone(note / 2, 2.4, {
          type: 'sine',
          gain: 0.02,
          attack: 0.4,
          destination: this.music ?? undefined,
        });
      }
      this.musicTimer = window.setTimeout(schedule, 1350 + Math.random() * 1700);
    };
    this.musicTimer = window.setTimeout(schedule, 1400);
  }
}

export const sound = new SoundKit();
