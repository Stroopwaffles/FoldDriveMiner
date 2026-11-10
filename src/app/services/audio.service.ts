import { Injectable, inject, signal } from '@angular/core';
import { SettingsService } from './settings.service';

/**
 * Sound effects generated in code with the Web Audio API — no audio files.
 * The context starts on the first user gesture (PRESS START), as browsers require.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  private readonly settings = inject(SettingsService);
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastDrill = 0;

  /** True once a user gesture has started the audio context. */
  readonly ready = signal(false);

  /** Shared with the music engine so everything runs on one clock. */
  get context(): AudioContext | null {
    return this.ctx;
  }

  get sharedNoise(): AudioBuffer | null {
    return this.noiseBuffer;
  }

  unlock(): void {
    if (typeof AudioContext === 'undefined') return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const len = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.ready.set(true);
  }

  // ------------------------------------------------------------ effects

  blip(): void {
    this.tone(880, 0.04, 'square', 0.08);
  }

  select(): void {
    this.tone(660, 0.05, 'square', 0.1);
    this.tone(990, 0.07, 'square', 0.1, 0.05);
  }

  denied(): void {
    this.tone(180, 0.12, 'sawtooth', 0.12, 0, 140);
  }

  drill(overdrive: boolean): void {
    // Throttle so rapid clicking doesn't stack into a roar.
    const now = this.ctx?.currentTime ?? 0;
    if (now - this.lastDrill < 0.03) return;
    this.lastDrill = now;
    this.noise(0.07, overdrive ? 2600 : 1400, overdrive ? 0.22 : 0.16);
    this.tone(overdrive ? 220 : 110, 0.06, 'sawtooth', 0.07, 0, overdrive ? 330 : 90);
  }

  crack(): void {
    this.noise(0.45, 600, 0.35);
    this.tone(90, 0.4, 'triangle', 0.25, 0, 40);
  }

  overdrive(): void {
    this.tone(300, 0.25, 'sawtooth', 0.1, 0, 900);
  }

  overheat(): void {
    this.tone(520, 0.18, 'square', 0.12, 0, 260);
    this.tone(520, 0.18, 'square', 0.12, 0.22, 260);
    this.noise(0.8, 3000, 0.12, 0.05);
  }

  sell(): void {
    [988, 1319, 1568].forEach((f, i) => this.tone(f, 0.09, 'square', 0.09, i * 0.06));
  }

  buy(): void {
    [523, 784].forEach((f, i) => this.tone(f, 0.08, 'triangle', 0.15, i * 0.05));
  }

  dataCore(): void {
    [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.14, i * 0.07));
  }

  /** Comm "voice" bleeps — a pitch per speaker. */
  comm(pitch = 600): void {
    for (let i = 0; i < 4; i++) {
      this.tone(pitch * (0.9 + Math.random() * 0.3), 0.035, 'square', 0.05, i * 0.05);
    }
  }

  // ------------------------------------------------------------ synth helpers

  private get volume(): number {
    return this.settings.settings().sfxVolume;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    delay = 0,
    slideTo?: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx || this.volume <= 0) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, cutoff: number, vol: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer || this.volume <= 0) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }
}
