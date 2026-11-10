import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { AudioService } from './audio.service';
import { SettingsService } from './settings.service';
import { TRACKS, Track, trackById } from './music-tracks';

/*
 * Background music, synthesized live with the Web Audio API.
 *
 * Tracks are data (see music-tracks.ts). This service is the "band": it reads
 * a track and plays drums, bass, pads, arpeggio and lead with a lookahead
 * scheduler on the audio clock. In playlist mode each track loops twice and
 * then hands over to the next one at a bar line.
 */

const STEPS_PER_BAR = 16;
const BARS = 16;
const LOOP_STEPS = STEPS_PER_BAR * BARS;
const LOOPS_PER_TRACK = 2;
const LOOKAHEAD = 0.15;
const TICK_MS = 25;

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

@Injectable({ providedIn: 'root' })
export class MusicService {
  private readonly audio = inject(AudioService);
  private readonly settings = inject(SettingsService);

  readonly tracks = TRACKS;
  private readonly trackIndex = signal(0);
  readonly nowPlaying = computed(() => TRACKS[this.trackIndex()]);

  private master: GainNode | null = null;
  private trackGain: GainNode | null = null;
  private delay: DelayNode | null = null;
  private delaySend: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private loops = 0;
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

    // Picking a specific track in Settings switches to it right away.
    effect(() => {
      const pick = this.settings.settings().musicTrack;
      const i = TRACKS.findIndex((t) => t.id === pick);
      if (i >= 0 && i !== this.trackIndex()) this.switchTo(i);
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

  /** Skip to the next track. In single-track mode this also changes the chosen track. */
  next(): void {
    const i = (this.trackIndex() + 1) % TRACKS.length;
    if (this.settings.settings().musicTrack !== 'auto') this.settings.update({ musicTrack: TRACKS[i].id });
    else this.switchTo(i);
  }

  private switchTo(i: number): void {
    this.trackIndex.set(i);
    this.step = 0;
    this.loops = 0;
    const ctx = this.audio.context;
    if (ctx && this.delay) {
      this.delay.delayTime.setTargetAtTime(this.stepLen() * 3, ctx.currentTime, 0.05);
      this.trackGain!.gain.setTargetAtTime(this.track.gain, ctx.currentTime, 0.2);
      // Small gap so the new track starts cleanly on a fresh bar.
      this.nextTime = Math.max(this.nextTime, ctx.currentTime + 0.25);
    }
  }

  private get track(): Track {
    return TRACKS[this.trackIndex()];
  }

  private stepLen(): number {
    return 60 / this.track.bpm / 4;
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
    this.trackGain = ctx.createGain();
    this.trackGain.gain.value = this.track.gain;
    this.trackGain.connect(this.master);

    // Dotted-eighth feedback delay for the arp and lead, timed to the track.
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = this.stepLen() * 3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.35;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.4;
    this.delaySend.connect(this.delay);
    this.delay.connect(tone).connect(feedback).connect(this.delay);
    tone.connect(this.trackGain);
  }

  private schedule(): void {
    const ctx = this.audio.context;
    if (!ctx) return;
    // If we fell behind (e.g. after a pause), jump forward instead of bursting notes.
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += this.stepLen();
      this.step++;
      if (this.step >= LOOP_STEPS) {
        this.step = 0;
        this.loops++;
        if (this.settings.settings().musicTrack === 'auto' && this.loops >= LOOPS_PER_TRACK) {
          this.switchTo((this.trackIndex() + 1) % TRACKS.length);
        }
      }
    }
  }

  // ------------------------------------------------------------ arrangement

  private playStep(step: number, t: number): void {
    const tr = this.track;
    const STEP = this.stepLen();
    const bar = Math.floor(step / STEPS_PER_BAR);
    const s = step % STEPS_PER_BAR;
    const chord = tr.chords[bar % tr.chords.length];

    // Drums
    switch (tr.drums) {
      case 'four':
        if (s % 4 === 0) this.kick(t);
        if (s === 4 || s === 12) this.snare(t);
        if (s % 2 === 0) this.hat(t, s % 4 === 2 ? 0.05 : 0.025);
        break;
      case 'drive':
        if (s % 4 === 0 || s === 14) this.kick(t);
        if (s === 4 || s === 12) this.snare(t);
        this.hat(t, s % 2 === 1 ? 0.045 : 0.02);
        break;
      case 'half':
        if (s === 0 || s === 10) this.kick(t);
        if (s === 8) this.snare(t);
        if (s % 4 === 2) this.hat(t, 0.03);
        break;
    }

    // Bass
    switch (tr.bass) {
      case 'octave':
        if (s % 2 === 0) this.bass(midi(chord.root + (s % 4 === 2 ? 12 : 0)), t, STEP * 1.8);
        break;
      case 'sustain':
        if (s === 0) this.bass(midi(chord.root), t, STEP * 14);
        if (s === 14) this.bass(midi(chord.root + 12), t, STEP * 1.8);
        break;
      case 'syncopated':
        if ([0, 3, 6, 8, 11, 14].includes(s)) this.bass(midi(chord.root + (s === 6 || s === 14 ? 12 : 0)), t, STEP * 1.6);
        break;
    }

    // Pads: one long chord per bar.
    if (s === 0) for (const n of chord.pad) this.pad(midi(n), t, STEP * STEPS_PER_BAR);

    // Arpeggio, quieter under the melody (bars 1–8), featured on bars 9–16.
    const notes = [...chord.pad, chord.pad[0] + 12];
    const level = bar >= 8 ? 0.07 : 0.035;
    switch (tr.arp) {
      case 'up':
        this.arp(midi(notes[s % 4] + 12), t, level, STEP);
        break;
      case 'updown': {
        const seq = [0, 1, 2, 3, 2, 1];
        this.arp(midi(notes[seq[s % seq.length]] + 12), t, level, STEP);
        break;
      }
      case 'sparse':
        if (s % 4 === 0) this.arp(midi(notes[(s / 4) % 4] + 24), t, level * 1.3, STEP * 3);
        break;
    }

    // Lead melody on bars 1–8.
    if (bar < 8) {
      for (const [at, note, len] of tr.melody[bar] ?? []) {
        if (at === s) this.lead(midi(note), t, len * STEP, tr.lead);
      }
    }
  }

  // ------------------------------------------------------------ instruments

  private env(ctx: AudioContext, t: number, peak: number, attack: number, decay: number, dest?: AudioNode): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(dest ?? this.trackGain!);
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

  private bass(freq: number, t: number, dur: number): void {
    const ctx = this.audio.context!;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + Math.min(dur, 0.3));
    osc.connect(lp).connect(this.env(ctx, t, 0.32, 0.005, dur));
    osc.start(t);
    osc.stop(t + dur + 0.05);
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
    lp.connect(g).connect(this.trackGain!);
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

  private arp(freq: number, t: number, level: number, dur: number): void {
    const ctx = this.audio.context!;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    const g = this.env(ctx, t, level, 0.003, dur * 0.9);
    g.connect(this.delaySend!);
    osc.connect(lp).connect(g);
    osc.start(t);
    osc.stop(t + dur);
  }

  private lead(freq: number, t: number, dur: number, voice: Track['lead']): void {
    const ctx = this.audio.context!;
    const peak = voice === 'triangle' ? 0.16 : 0.11;
    const attack = voice === 'triangle' ? 0.08 : voice === 'brass' ? 0.04 : 0.02;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + Math.max(attack + 0.01, dur - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    g.connect(this.trackGain!);
    g.connect(this.delaySend!);

    // Gentle vibrato that fades in on held notes.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = voice === 'triangle' ? 4.5 : 5.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0, t);
    lfoGain.gain.linearRampToValueAtTime(freq * 0.008, t + Math.min(dur, 0.4));
    lfo.connect(lfoGain);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    if (voice === 'brass') {
      // Filter "swell" gives the saw a brassy bite.
      lp.frequency.setValueAtTime(700, t);
      lp.frequency.exponentialRampToValueAtTime(3200, t + 0.12);
    } else {
      lp.frequency.value = voice === 'triangle' ? 2000 : 2800;
    }
    lp.connect(g);

    const oscs: [OscillatorType, number][] =
      voice === 'triangle' ? [['triangle', 0], ['sine', 1200]] : voice === 'brass' ? [['sawtooth', -7], ['sawtooth', 7]] : [['sawtooth', -5], ['square', 5]];
    for (const [type, detune] of oscs) {
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

  /** For the settings screen. */
  trackName(id: string): string {
    return trackById(id)?.name ?? 'Playlist';
  }
}
