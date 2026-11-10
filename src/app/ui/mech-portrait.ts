import { Component, computed, input } from '@angular/core';
import { FrameId, SlotId, frameDef } from '../game/fleet-data';

/**
 * Mech drawn from its frame and fitted parts, so the loadout shows on the model.
 * Flat cel-shaded shapes with a dark outline, in a 100×120 box.
 */
@Component({
  selector: 'fdm-mech-portrait',
  template: `
    @let p = parts();
    <svg viewBox="0 0 100 120" [attr.width]="size()" [attr.height]="size() * 1.2" aria-hidden="true">
      <g stroke="#05060f" stroke-width="1.6" stroke-linejoin="round" [attr.fill]="body()">
        <!-- thrusters (behind) -->
        @if (p.thrusters === 'booster_wing') {
          <polygon points="30,40 6,26 10,56 30,58" fill="#2a3168" />
          <polygon points="70,40 94,26 90,56 70,58" fill="#2a3168" />
        } @else if (p.thrusters) {
          <rect x="28" y="38" width="10" height="22" fill="#2a3168" />
          <rect x="62" y="38" width="10" height="22" fill="#2a3168" />
        }
        <!-- legs -->
        <polygon [attr.points]="legL()" />
        <polygon [attr.points]="legR()" />
        <!-- torso -->
        <polygon [attr.points]="torso()" />
        <polygon points="42,52 58,52 56,66 44,66" fill="#0d1030" />
        <rect x="46" y="56" width="8" height="5" [attr.fill]="accent()" stroke="none" />
        <!-- armor plating -->
        @if (p.armor) {
          <polygon points="32,46 44,44 44,72 34,74" [attr.fill]="shade()" />
          <polygon points="68,46 56,44 56,72 66,74" [attr.fill]="shade()" />
          @if (p.armor === 'composite_plate') {
            <line x1="35" y1="56" x2="43" y2="55" /><line x1="65" y1="56" x2="57" y2="55" />
          }
        }
        <!-- shoulders -->
        <polygon [attr.points]="shoulderL()" />
        <polygon [attr.points]="shoulderR()" />
        <!-- left arm + off-hand -->
        <polygon points="18,50 28,48 30,76 20,78" />
        @switch (p.offhand) {
          @case ('grapple') {
            <polygon points="16,78 32,76 30,88 26,84 22,88 18,84" fill="#8d95c7" />
          }
          @case ('probe_launcher') {
            <rect x="12" y="68" width="14" height="18" fill="#1b2250" />
            <circle cx="19" cy="72" r="2" fill="#6dff9b" stroke="none" /><circle cx="19" cy="80" r="2" fill="#6dff9b" stroke="none" />
          }
          @case ('riot_shield') {
            <polygon points="6,56 22,52 24,96 8,98" fill="#4a54a0" />
          }
          @case ('rail_rifle') {
            <rect x="14" y="74" width="8" height="34" fill="#2a3168" />
            <rect x="16" y="104" width="4" height="12" fill="#ff3b3b" stroke="none" />
          }
          @default {
            <rect x="19" y="78" width="10" height="8" />
          }
        }
        <!-- right arm + drill -->
        <polygon points="72,48 82,50 80,78 70,76" />
        @switch (p.drill) {
          @case ('hand_drill') {
            <polygon points="70,78 82,78 76,98" fill="#c0c8d8" />
          }
          @case ('breaker') {
            <rect x="70" y="78" width="12" height="14" fill="#8d95c7" />
            <rect x="74" y="92" width="4" height="14" fill="#c0c8d8" />
          }
          @case ('plasma_lance') {
            <rect x="71" y="78" width="10" height="10" fill="#2a3168" />
            <polygon points="72,88 80,88 76,118" fill="#ff3d9a" />
            <polygon points="74,90 78,90 76,112" fill="#fff" stroke="none" opacity="0.8" />
          }
          @default {
            <rect x="71" y="78" width="10" height="8" />
          }
        }
        <!-- head -->
        <polygon [attr.points]="head()" />
        @if (p.sensor === 'radar_dome') {
          <path d="M40 22 Q50 8 60 22Z" fill="#c0c8d8" />
        } @else {
          <polygon points="49,24 51,24 50,14" />
        }
      </g>
      <!-- visor -->
      @if (p.sensor === 'optic_visor' || p.sensor === 'radar_dome') {
        <rect x="40" y="31" width="20" height="5" rx="1" fill="#4fe3ff" class="eye" />
      } @else {
        <rect x="41" y="31" width="6" height="4" fill="#ffb547" class="eye" />
        <rect x="53" y="31" width="6" height="4" fill="#ffb547" class="eye" />
      }
      <!-- reactor glow -->
      @if (p.reactor) {
        <circle cx="50" cy="58.5" r="3" [attr.fill]="reactorColor()" class="core" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-block;
      line-height: 0;
    }
    .eye {
      filter: drop-shadow(0 0 2px currentColor);
    }
    .core {
      animation: core 1.6s ease-in-out infinite alternate;
    }
    @keyframes core {
      to {
        opacity: 0.5;
      }
    }
  `,
})
export class MechPortrait {
  readonly frame = input<FrameId>('pickaxe');
  readonly parts = input<Partial<Record<SlotId, string>>>({});
  readonly size = input(90);

  protected readonly body = computed(() => ({ pickaxe: '#c98a3a', kestrel: '#3a8fb0', bulwark: '#a03a6a' })[this.frame()]);
  protected readonly shade = computed(() => ({ pickaxe: '#8a5a20', kestrel: '#235a72', bulwark: '#6a2046' })[this.frame()]);
  protected readonly accent = computed(() => frameDef(this.frame()).color);
  protected readonly reactorColor = computed(() =>
    this.parts().reactor === 'he3_reactor' ? '#9dff8a' : this.parts().reactor === 'twin_core' ? '#4fe3ff' : '#ffb547',
  );

  // Frame silhouettes: Pickaxe is stocky, Kestrel slim, Bulwark wide.
  private readonly w = computed(() => ({ pickaxe: 1, kestrel: 0.82, bulwark: 1.18 })[this.frame()]);
  private sx(x: number): number {
    return 50 + (x - 50) * this.w();
  }
  private pts(list: [number, number][]): string {
    return list.map(([x, y]) => `${this.sx(x).toFixed(1)},${y}`).join(' ');
  }

  protected readonly torso = computed(() => this.pts([[34, 40], [66, 40], [70, 58], [62, 76], [38, 76], [30, 58]]));
  protected readonly legL = computed(() => this.pts([[38, 76], [48, 76], [47, 104], [50, 118], [32, 118], [36, 104]]));
  protected readonly legR = computed(() => this.pts([[52, 76], [62, 76], [64, 104], [68, 118], [50, 118], [53, 104]]));
  protected readonly shoulderL = computed(() => this.pts([[16, 40], [34, 38], [34, 52], [18, 54]]));
  protected readonly shoulderR = computed(() => this.pts([[66, 38], [84, 40], [82, 54], [66, 52]]));
  protected readonly head = computed(() => this.pts([[40, 24], [60, 24], [62, 38], [56, 42], [44, 42], [38, 38]]));
}
