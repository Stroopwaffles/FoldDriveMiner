import { Component, computed, input } from '@angular/core';
import { Rng } from '../game/rng';

interface Look {
  skin: string;
  hair: string;
  eyes: string;
  suit: string;
  style: number;
  accessory: number;
}

const SKINS = ['#ffd8b8', '#f2c29b', '#d9a07a', '#b97a55', '#8a5a3c', '#5e3b27'];
const HAIRS = ['#1a1a2e', '#5a3420', '#e8c86a', '#c0c8d8', '#ff5fa2', '#4fa8ff', '#6dd47e', '#9d6bff', '#ff5a2b'];
const EYES = ['#1a3a8f', '#2e7d4f', '#7a3b12', '#8a1f4a', '#2a2a2a', '#00a5b8'];
const SUITS = ['#ff7a3d', '#4fe3ff', '#ff3d9a', '#ffd23f', '#6dff9b', '#c77dff', '#e8ecff'];

/** Fixed looks for the story pilots. */
const STORY_LOOKS: Record<string, Look> = {
  juno: { skin: '#ffd8b8', hair: '#ff5a2b', eyes: '#1a3a8f', suit: '#ff7a3d', style: 0, accessory: 0 },
  kit: { skin: '#5e3b27', hair: '#1a1a2e', eyes: '#7a3b12', suit: '#6dff9b', style: 3, accessory: 2 },
};

/** Cel-shaded 80s anime-style head-and-shoulders, generated from a seed. */
@Component({
  selector: 'fdm-pilot-portrait',
  template: `
    @let l = look();
    <svg
      [attr.viewBox]="eyes() ? '9 15 22 10' : '0 0 40 40'"
      [attr.preserveAspectRatio]="eyes() ? 'xMidYMid slice' : null"
      [attr.width]="eyes() ? '100%' : size()"
      [attr.height]="eyes() ? '100%' : size()"
      [class.eyes]="eyes()"
      aria-hidden="true"
    >
      <rect width="40" height="40" [attr.fill]="bg()" />
      <!-- suit -->
      <path d="M6 40 Q20 29 34 40Z" fill="#141a3d" />
      <path d="M13 33 L27 33 L29 40 L11 40Z" [attr.fill]="l.suit" />
      <path d="M18 33 L22 33 L21 40 L19 40Z" fill="#05060f" opacity="0.5" />
      <!-- back hair -->
      @if (l.style === 2 || l.style === 4) {
        <path d="M10 18 Q9 34 14 36 L26 36 Q31 34 30 18Z" [attr.fill]="l.hair" />
      }
      <!-- neck + face -->
      <rect x="17.5" y="27" width="5" height="5" [attr.fill]="l.skin" />
      <ellipse cx="20" cy="21" rx="8" ry="9.5" [attr.fill]="l.skin" />
      <path d="M12.5 22 Q14 29 20 30.5 Q17 27 16 22Z" fill="#000" opacity="0.12" />
      <!-- eyes -->
      @for (cx of [16.1, 23.9]; track cx; let right = $last) {
        <!-- anime eye: white, tall iris, pupil, highlight, heavy lash line, brow -->
        <ellipse [attr.cx]="cx" cy="22.1" rx="2.1" ry="2.2" fill="#fff" />
        <ellipse [attr.cx]="cx" cy="22.3" rx="1.55" ry="2" [attr.fill]="l.eyes" />
        <ellipse [attr.cx]="cx" cy="22.7" rx="0.75" ry="1.1" fill="#05060f" opacity="0.75" />
        <circle [attr.cx]="cx - 0.55" cy="21.6" r="0.5" fill="#fff" />
        <circle [attr.cx]="cx + 0.6" cy="23.3" r="0.22" fill="#fff" />
        <path [attr.d]="right ? 'M21.6 20.6 Q24 19.3 26.4 20.4' : 'M13.6 20.4 Q16 19.3 18.4 20.6'" stroke="#1a0a12" stroke-width="0.95" fill="none" stroke-linecap="round" />
        <path [attr.d]="right ? 'M21.8 18.3 Q24 17.4 26.2 18.1' : 'M13.8 18.1 Q16 17.4 18.2 18.3'" [attr.stroke]="l.hair" stroke-width="0.7" fill="none" stroke-linecap="round" />
      }
      <path d="M17 27 Q20 28.6 23 27" stroke="#8a3a2a" fill="none" stroke-width="0.9" />
      <!-- front hair -->
      @switch (l.style) {
        @case (0) {
          <path d="M10 20 Q8 6 20 6 Q33 5 31 20 L28 13 L25 17 L22 11 L18 16 L15 11 L13 17Z" [attr.fill]="l.hair" />
          <path d="M10 20 L6 26 L12 22Z M31 20 L35 25 L28 22Z" [attr.fill]="l.hair" />
        }
        @case (1) {
          <path d="M10 24 Q8 7 20 7 Q32 7 30 24 L28 16 Q20 13 12 16Z" [attr.fill]="l.hair" />
        }
        @case (2) {
          <path d="M11 19 Q10 6 20 6 Q30 6 29 19 Q25 12 20 14 Q15 12 11 19Z" [attr.fill]="l.hair" />
        }
        @case (3) {
          <path d="M11 17 Q11 8 20 8 Q29 8 29 17 Q26 12 20 12 Q14 12 11 17Z" [attr.fill]="l.hair" />
          <circle cx="13" cy="12" r="2.4" [attr.fill]="l.hair" /><circle cx="17" cy="9.5" r="2.6" [attr.fill]="l.hair" />
          <circle cx="22" cy="9.5" r="2.6" [attr.fill]="l.hair" /><circle cx="27" cy="12" r="2.4" [attr.fill]="l.hair" />
        }
        @default {
          <path d="M11 19 Q10 6 20 6 Q30 6 29 19 L26 12 L20 15 L14 12Z" [attr.fill]="l.hair" />
          <path d="M28 10 Q36 12 33 24 Q31 16 27 14Z" [attr.fill]="l.hair" />
        }
      }
      <!-- accessory -->
      @switch (l.accessory) {
        @case (1) {
          <rect x="12" y="19" width="16" height="4.2" rx="1" fill="#4fe3ff" opacity="0.55" />
        }
        @case (2) {
          <rect x="13" y="12.5" width="5.5" height="3.2" rx="1.4" fill="#ffd23f" stroke="#05060f" stroke-width="0.6" />
          <rect x="21.5" y="12.5" width="5.5" height="3.2" rx="1.4" fill="#ffd23f" stroke="#05060f" stroke-width="0.6" />
        }
        @case (3) {
          <path d="M11 21 Q10 14 13 13 M29 21 Q30 14 27 13" stroke="#e8ecff" stroke-width="1" fill="none" />
          <rect x="9.5" y="20" width="2.5" height="4" rx="1" fill="#e8ecff" />
        }
        @case (4) {
          <path d="M24 17 L27 24" stroke="#a03a2a" stroke-width="0.8" />
        }
      }
      @if (injured()) {
        <rect x="8" y="9" width="10" height="2.6" fill="#fff" transform="rotate(-20 13 10)" />
        <rect width="40" height="40" fill="#ff3b3b" opacity="0.15" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-block;
      line-height: 0;
    }
    svg {
      display: block;
      border: 1px solid var(--bezel-hi);
    }
    :host:has(svg.eyes) {
      display: block;
      width: 100%;
      height: 100%;
    }
    svg.eyes {
      border: none;
    }
  `,
})
export class PilotPortrait {
  readonly seed = input(0);
  readonly story = input<string | null>(null);
  readonly size = input(40);
  readonly injured = input(false);
  /** Crop to an extreme close-up of the eyes (for cut-ins). */
  readonly eyes = input(false);

  protected readonly look = computed<Look>(() => {
    const story = this.story();
    if (story && STORY_LOOKS[story]) return STORY_LOOKS[story];
    const rng = new Rng(this.seed() || 7);
    const pick = <T>(list: T[]) => list[Math.floor(rng.next() * list.length)];
    return {
      skin: pick(SKINS),
      hair: pick(HAIRS),
      eyes: pick(EYES),
      suit: pick(SUITS),
      style: Math.floor(rng.next() * 5),
      accessory: Math.floor(rng.next() * 5),
    };
  });

  protected readonly bg = computed(() => {
    const story = this.story();
    if (story === 'juno') return '#2a0f3d';
    if (story === 'kit') return '#0f2a24';
    return '#141a3d';
  });
}
