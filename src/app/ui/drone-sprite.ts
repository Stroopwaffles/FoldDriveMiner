import { Component, computed, input } from '@angular/core';
import { DroneType, droneDef } from '../game/fleet-data';

/**
 * One small cel-shaded drone per type, so each role reads at a glance:
 * Prospector (diamond miner), Cutter (laser blade), Hauler (cargo pod),
 * Surveyor (sensor dish), Salvager (claw), Guardian (shield).
 * Drawn in a -12..12 box; `facing` rotates it (for orbiting sprites).
 */
@Component({
  selector: 'fdm-drone-sprite',
  template: `
    @let c = color();
    <svg viewBox="-12 -12 24 24" [attr.width]="size()" [attr.height]="size()" aria-hidden="true" [class]="'t-' + type()">
      <g stroke-linejoin="round" [attr.stroke]="c">
        @switch (type()) {
          @case ('cutter') {
            <!-- swept blade with a cutting laser out front -->
            <line class="laser" x1="6" y1="0" x2="12" y2="0" stroke="#ff3b3b" stroke-width="1.6" />
            <polygon points="8,0 -6,-8 -3,0 -6,8" fill="#2a1410" stroke-width="1.4" />
            <polygon points="4,0 -3,-3 -1.5,0 -3,3" [attr.fill]="c" stroke="none" />
            <circle cx="-5" cy="0" r="1.5" fill="#ffb547" stroke="none" />
          }
          @case ('hauler') {
            <!-- boxy cargo pod with hazard stripes and twin thrusters -->
            <rect x="-10" y="-4.5" width="3" height="3" fill="#ff7a3d" stroke="none" class="flame" />
            <rect x="-10" y="1.5" width="3" height="3" fill="#ff7a3d" stroke="none" class="flame" />
            <rect x="-7" y="-6.5" width="15" height="13" rx="1.5" fill="#2a2410" stroke-width="1.4" />
            <path d="M-4 -6.5 L-1 6.5 M1 -6.5 L4 6.5" stroke="#05060f" stroke-width="1.6" />
            <rect x="5" y="-3" width="3" height="6" fill="#ffd23f" stroke="none" />
          }
          @case ('surveyor') {
            <!-- dish with an antenna and a sweeping scan ring -->
            <circle class="scan" r="10" fill="none" stroke-width="0.8" />
            <circle r="6.5" fill="#0f2a1c" stroke-width="1.4" />
            <path d="M-3 -3 Q4 -1 3 4" fill="none" stroke-width="1.2" />
            <line x1="0" y1="0" x2="4.5" y2="-4.5" stroke-width="1" />
            <circle cx="4.8" cy="-4.8" r="1.4" fill="#ffb547" stroke="none" />
            <circle r="1.6" [attr.fill]="c" stroke="none" />
          }
          @case ('salvager') {
            <!-- hexagon body with two grabbing claws -->
            <path class="claw" d="M5 -3 L10 -6 L11 -2 M5 3 L10 6 L11 2" fill="none" stroke-width="1.6" stroke-linecap="round" />
            <polygon points="-6,0 -3,-5.5 3,-5.5 6,0 3,5.5 -3,5.5" fill="#1e1030" stroke-width="1.4" />
            <polygon points="-2.5,0 -1.2,-2.2 1.2,-2.2 2.5,0 1.2,2.2 -1.2,2.2" [attr.fill]="c" stroke="none" />
          }
          @case ('guardian') {
            <!-- shield with a turret barrel -->
            <rect x="3" y="-1" width="8" height="2" fill="#8d95c7" stroke="none" />
            <path d="M-8 -8 L4 -8 L6 0 L4 8 L-8 8 L-5 0Z" fill="#2a0a10" stroke-width="1.4" />
            <path d="M-4 -4 L2 -4 L3 0 L2 4 L-4 4 L-2 0Z" [attr.fill]="c" stroke="none" opacity="0.8" />
          }
          @default {
            <!-- prospector: the classic diamond miner -->
            <polygon points="0,-10 10,0 0,10 -10,0" fill="#1b2250" stroke-width="1.5" />
            <polygon points="0,-5 5,0 0,5 -5,0" fill="#0b0e24" stroke-width="1" />
            <circle r="2" fill="#ffb547" stroke="none" />
          }
        }
      </g>
    </svg>
  `,
  styles: `
    :host {
      display: inline-block;
      line-height: 0;
    }
    svg {
      overflow: visible;
      filter: drop-shadow(0 0 3px var(--glow));
    }
    .laser {
      animation: flicker 0.15s steps(2) infinite;
    }
    .flame {
      animation: flicker 0.2s steps(2) infinite;
    }
    .scan {
      transform-origin: center;
      transform-box: fill-box;
      animation: scan 1.8s ease-out infinite;
    }
    .claw {
      transform-origin: 5px 0;
      transform-box: view-box;
      animation: snap 1.4s ease-in-out infinite;
    }
    @keyframes flicker {
      50% {
        opacity: 0.35;
      }
    }
    @keyframes scan {
      from {
        transform: scale(0.5);
        opacity: 0.9;
      }
      to {
        transform: scale(1.2);
        opacity: 0;
      }
    }
    @keyframes snap {
      50% {
        transform: scaleY(0.6);
      }
    }
  `,
  host: {
    '[style.--glow]': 'color()',
  },
})
export class DroneSprite {
  readonly type = input<DroneType>('prospector');
  readonly size = input(24);

  protected readonly color = computed(() => droneDef(this.type()).color);
}
