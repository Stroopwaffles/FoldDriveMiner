import { DestroyRef, Injectable, effect, inject } from '@angular/core';
import { AudioService } from './audio.service';
import { SettingsService } from './settings.service';

/*
 * Background music, synthesized live with the Web Audio API.
 *
 * An original 16-bar synthwave loop in A minor (Am – F – C – G), 100 BPM:
 * drums, a pumping octave bass, detuned pads, a delayed arpeggio and a lead
 * melody that plays on the first 8 bars and rests on the second 8.
 * Notes are scheduled slightly ahead on the audio clock (the usual
 * "lookahead scheduler" pattern) so timing stays tight.
 */

const BPM = 100;
const STEP = 60 / BPM / 4; // one 16th note, in seconds
const STEPS_PER_BAR = 16;
const BARS = 16;
const LOOKAHEAD = 0.15;
const TICK_MS = 25;

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

// Chords as MIDI notes (pad voicing around middle C) and bass roots.
const CHORDS = [
  { pad: [57, 60, 64], root: 33 }, // Am
  { pad: [53, 57, 60], root: 29 }, // F
  { pad: [55, 60, 64], root: 36 }, // C
  { pad: [55, 59, 62], root: 31 }, // G
];

// Lead melody: per bar, [step, midi note, length in steps]. Bars 1–8 only.
const MELODY: [number, number, number][][] = [
  [[0, 76, 4], [4, 74, 2], [6, 72, 2], [8, 74, 4], [12, 76, 4]],
  [[0, 77, 6], [6, 76, 2], [8, 72, 8]],
  [[0, 79, 4], [4, 76, 4], [8, 72, 2], [10, 74, 2], [12, 76, 4]],
  [[0, 74, 8], [8, 71, 4], [12, 74, 4]],
  [[0, 81, 4], [4, 79, 2], [6, 76, 2], [8, 72, 4], [12, 76, 4]],
  [[0, 77, 4], [4, 81, 4], [8, 79, 4], [12, 77, 4]],
  [[0, 76, 4], [4, 79, 4], [8, 84, 8]],
  [[0, 83, 4], [4, 81, 2], [6, 79, 2], [8, 74, 8]],
];

@Injectable({ providedIn: 'root' })
export class MusicService {
  private readonly audio = inject(AudioService);
  private readonly settings = inject(SettingsService);

  private master: GainNode | null = null;
  private delaySend: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;
  private hidden = false;

  constructor() {
    // Start/stop and volume follow the settings and the audio unlock.
    effect(() => {
      const ready = this.audio.ready();
      const { music, musicVolume } = this.settings.settings();
      if (!ready) return;
      this.setVolume(music ? musicVolume : 0);
      if (music && !this.hidden) this.start();
      else this.stop();
    });

    // Pause while the tab is hidden: background tabs throttle timers, which would make the music stutter.
    if (typeof document !== 'undefined') {
      const onVis = () => {
        this.hidden = document.visibilityState === 'hidden';
        if (this.hidden) this.stop();
        else if (this.settings.settings().music && this.audio.ready()) this.start();
      };
      document.addEventListener('visibilitychange', onVis);
      inject(DestroyRef).onDestroy(() => {
        document.removeEventListener('visibilitychange', onVis);
        this.stop();
      });
    }
  }

  toggle(): void {
    this.settings.update({ music: !this.settings.settings().music });
  }

  // ------------------------------------------------------------ transport

  private start(): void {
    const ctx = this.audio.context;
    if (!ctx || this.timer) return;
    this.ensureGraph(ctx);
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private setVolume(v: number): void {
    const ctx = this.audio.context;
    if (!ctx) return;
    this.ensureGraph(ctx);
    // Music sits under the sound effects.
    this.master!.gain.setTargetAtTime(v * 0.35, ctx.currentTime, 0.15);
  }

  private ensureGraph(ctx: AudioContext): void {
    if (this.master) return;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // Dotted-eighth feedback delay for the arp and lead.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = STEP * 3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.35;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.4;
    this.delaySend.connect(delay);
    delay.connect(tone).connect(feedback).connect(delay);
    tone.connect(this.master);
  }

  private schedule(): void {
    const ctx = this.audio.context;
    if (!ctx) return;
    // If we fell behind (e.g. after a pause), jump forward instead of bursting notes.
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step = (this.step + 1) % (BARS * STEPS_PER_BAR);
    }
  }

  // ------------------------------------------------------------ arrangement

  private playStep(step: number, t: number): void {
    const bar = Math.floor(step / STEPS_PER_BAR);
    const s = step % STEPS_PER_BAR;
    const chord = CHORDS[bar % 4];

    // Drums: four-on-the-floor kick, snare on 2 and 4, eighth hats.
    if (s % 4 === 0) this.kick(t);
    if (s === 4 || s === 12) this.snare(t);
    if (s % 2 === 0) this.hat(t, s % 4 === 2 ? 0.05 : 0.025);

    // Driving octave bass on every eighth.
    if (s % 2 === 0) this.bass(midi(chord.root + (s % 4 === 2 ? 12 : 0)), t);

    // Pads: one long chord per bar.
    if (s === 0) for (const n of chord.pad) this.pad(midi(n), t, STEP * STEPS_PER_BAR);

    // Arpeggio: chord tones up two octaves, 16ths, in the second half of the loop
    // and quietly under the melody in the first half.
    const arpNotes = [...chord.pad, chord.pad[0] + 12];
    const arpNote = arpNotes[s % 4] + 12;
    this.arp(midi(arpNote), t, bar >= 8 ? 0.07 : 0.035);

    // Lead melody on bars 1–8.
    if (bar < 8) {
      for (const [at, note, len] of MELODY[bar]) {
        if (at === s) this.lead(midi(note), t, len * STEP);
      }
    }
  }

  // ------------------------------------------------------------ instruments

  private env(ctx: AudioContext, t: number, peak: number, attack: number, decay: number, dest?: AudioNode): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(dest ?? this.master!);
    return g;
  }

  private kick(t: number): void {
    const ctx = this.audio.context!;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    osc.connect(this.env(ctx, t, 0.9, 0.003, 0.28));
    osc.start(t);
    osc.stop(t + 0.32);
  }

  private snare(t: number): void {
    const ctx = this.audio.context!;
    const src = this.noiseSource(ctx);
    if (src) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800;
      bp.Q.value = 0.8;
      src.connect(bp).connect(this.env(ctx, t, 0.45, 0.002, 0.18));
      src.start(t, Math.random() * 0.5);
      src.stop(t + 0.22);
    }
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(190, t);
    body.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    body.connect(this.env(ctx, t, 0.25, 0.002, 0.1));
    body.start(t);
    body.stop(t + 0.14);
  }

  private hat(t: number, level: number): void {
    const ctx = this.audio.context!;
    const src = this.noiseSource(ctx);
    if (!src) return;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    src.connect(hp).connect(this.env(ctx, t, level * 4, 0.001, 0.04));
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.06);
  }

  private bass(freq: number, t: number): void {
    const ctx = this.audio.context!;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + STEP * 1.6);
    osc.connect(lp).connect(this.env(ctx, t, 0.32, 0.005, STEP * 1.8));
    osc.start(t);
    osc.stop(t + STEP * 2);
  }

  private pad(freq: number, t: number, dur: number): void {
    const ctx = this.audio.context!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1300;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.6);
    g.gain.setValueAtTime(0.06, t + dur - 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
    lp.connect(g).connect(this.master!);
    for (const detune of [-9, 9]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(lp);
      osc.start(t);
      osc.stop(t + dur + 0.25);
    }
  }

  private arp(freq: number, t: number, level: number): void {
    const ctx = this.audio.context!;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    const g = this.env(ctx, t, level, 0.003, STEP * 0.9);
    g.connect(this.delaySend!);
    osc.connect(lp).connect(g);
    osc.start(t);
    osc.stop(t + STEP);
  }

  private lead(freq: number, t: number, dur: number): void {
    const ctx = this.audio.context!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.02);
    g.gain.setValueAtTime(0.11, t + Math.max(0.03, dur - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    g.connect(this.master!);
    g.connect(this.delaySend!);

    // Gentle vibrato that fades in on held notes.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0, t);
    lfoGain.gain.linearRampToValueAtTime(freq * 0.008, t + Math.min(dur, 0.4));
    lfo.connect(lfoGain);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2800;
    lp.connect(g);
    for (const [type, detune] of [['sawtooth', -5], ['square', 5]] as [OscillatorType, number][]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      lfoGain.connect(osc.frequency);
      osc.connect(lp);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    }
    lfo.start(t);
    lfo.stop(t + dur + 0.1);
  }

  private noiseSource(ctx: AudioContext): AudioBufferSourceNode | null {
    const buf = this.audio.sharedNoise;
    if (!buf) return null;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }
}
