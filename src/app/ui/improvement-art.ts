import { Component, input } from '@angular/core';
import { ImprovementId } from '../game/improvement-data';

/** A small line-art drawing of a sector improvement, for the BOARD and the viewport. */
@Component({
  selector: 'fdm-improvement-art',
  template: `
    <svg viewBox="0 0 64 64" [attr.width]="size()" [attr.height]="size()" aria-hidden="true" [class.still]="still()">
      @switch (id()) {
        @case ('mining_station') {
          <rect x="14" y="26" width="30" height="18" rx="2" class="hull" />
          <rect x="18" y="30" width="6" height="4" class="win" />
          <rect x="27" y="30" width="6" height="4" class="win" />
          <line x1="44" y1="35" x2="56" y2="44" class="arm" />
          <polygon points="54,42 60,46 56,50" class="drill" />
          <line x1="29" y1="26" x2="29" y2="14" class="arm" />
          <circle cx="29" cy="13" r="2" class="blink" />
          <rect x="10" y="44" width="38" height="4" class="hull" />
        }
        @case ('refinery_annex') {
          <rect x="12" y="30" width="34" height="20" class="hull" />
          <rect x="16" y="16" width="7" height="14" class="hull" />
          <rect x="30" y="20" width="7" height="10" class="hull" />
          <rect x="16" y="36" width="26" height="8" class="glow" />
          <circle cx="19.5" cy="12" r="3" class="smoke" />
          <circle cx="33.5" cy="15" r="2.5" class="smoke late" />
        }
        @case ('fusion_plant') {
          <ellipse cx="32" cy="34" rx="22" ry="9" class="hull" />
          <ellipse cx="32" cy="34" rx="13" ry="5" class="ring" />
          <circle cx="32" cy="34" r="5" class="core" />
          <line x1="32" y1="43" x2="32" y2="54" class="arm" />
          <rect x="24" y="54" width="16" height="4" class="hull" />
        }
        @case ('fuel_depot') {
          @for (x of [14, 28, 42]; track x) {
            <rect [attr.x]="x" y="20" width="10" height="28" rx="5" class="tank" />
            <line [attr.x1]="x + 2" y1="30" [attr.x2]="x + 8" y2="30" class="band" />
          }
          <rect x="10" y="48" width="46" height="4" class="hull" />
          <circle cx="47" cy="17" r="2" class="blink" />
        }
        @case ('sensor_relay') {
          <path d="M16 38 Q32 14 48 30" class="dish" />
          <line x1="32" y1="27" x2="40" y2="20" class="arm" />
          <circle cx="41" cy="19" r="2" class="blink" />
          <line x1="32" y1="34" x2="32" y2="52" class="arm" />
          <rect x="24" y="52" width="16" height="4" class="hull" />
          <path d="M46 14 q6 4 0 10 M50 10 q9 7 0 18" class="pulse" />
        }
        @case ('research_lab') {
          <path d="M12 46 A20 20 0 0 1 52 46 Z" class="dome" />
          <line x1="32" y1="26" x2="44" y2="12" class="arm" />
          <circle cx="45" cy="11" r="3" class="scope" />
          @for (x of [20, 30, 40]; track x) {
            <rect [attr.x]="x" y="38" width="4" height="4" class="win" />
          }
          <rect x="8" y="46" width="48" height="4" class="hull" />
        }
        @case ('defense_platform') {
          <polygon points="8,44 56,44 50,52 14,52" class="hull" />
          <rect x="22" y="32" width="20" height="12" rx="3" class="hull" />
          <line x1="40" y1="36" x2="56" y2="26" class="gun" />
          <line x1="40" y1="40" x2="56" y2="32" class="gun" />
          <circle cx="32" cy="38" r="2" class="blink red" />
        }
        @case ('habitat_dome') {
          <path d="M10 46 A22 22 0 0 1 54 46 Z" class="glass" />
          <path d="M18 46 q4 -10 8 0 q4 -14 8 0 q4 -8 8 0" class="green" />
          <rect x="6" y="46" width="52" height="4" class="hull" />
          <circle cx="32" cy="24" r="1.5" class="blink" />
        }
        @case ('spaceport') {
          <ellipse cx="28" cy="46" rx="20" ry="5" class="pad" />
          <rect x="48" y="18" width="6" height="28" class="hull" />
          <rect x="46" y="14" width="10" height="5" class="win" />
          <polygon points="22,40 28,26 34,40" class="ship" />
          @for (x of [12, 20, 36, 44]; track x) {
            <circle [attr.cx]="x" cy="46" r="1.2" class="blink" />
          }
        }
        @case ('terraform_array') {
          <circle cx="32" cy="36" r="16" class="planet" />
          <path d="M20 34 q6 -6 10 0 q4 4 10 -2" class="green" />
          <path d="M24 44 q5 -3 9 1" class="green" />
          <line x1="32" y1="6" x2="32" y2="20" class="beam" />
          <line x1="10" y1="12" x2="22" y2="24" class="beam late" />
          <line x1="54" y1="12" x2="42" y2="24" class="beam" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-block;
      line-height: 0;
    }
    svg {
      overflow: visible;

      .hull {
        fill: #1a2046;
        stroke: #9aa3c7;
        stroke-width: 1.4;
      }
      .win {
        fill: #ffd23f;
      }
      .arm,
      .gun {
        stroke: #9aa3c7;
        stroke-width: 2;
        stroke-linecap: round;
      }
      .gun {
        stroke: #ff6b6b;
      }
      .drill {
        fill: #ffb547;
      }
      .glow {
        fill: #ff7a3d;
        filter: drop-shadow(0 0 4px #ff7a3d);
      }
      .smoke {
        fill: rgba(200, 210, 230, 0.35);
        animation: rise 3s ease-out infinite;
        &.late {
          animation-delay: 1.4s;
        }
      }
      .ring {
        fill: none;
        stroke: #4fe3ff;
        stroke-width: 1.5;
      }
      .core {
        fill: #fff6c8;
        filter: drop-shadow(0 0 6px #4fe3ff);
        animation: pulse 2s ease-in-out infinite;
      }
      .tank {
        fill: #10302a;
        stroke: #9dff8a;
        stroke-width: 1.4;
      }
      .band {
        stroke: #9dff8a;
      }
      .dish {
        fill: none;
        stroke: #c0c8d8;
        stroke-width: 3;
      }
      .pulse {
        fill: none;
        stroke: #4fe3ff;
        stroke-width: 1.4;
        animation: pulse 1.6s ease-in-out infinite;
      }
      .dome,
      .glass {
        fill: rgba(79, 227, 255, 0.12);
        stroke: #4fe3ff;
        stroke-width: 1.4;
      }
      .scope {
        fill: #c77dff;
      }
      .green {
        fill: none;
        stroke: #6dff9b;
        stroke-width: 2;
      }
      .pad {
        fill: #1a2046;
        stroke: #ffd23f;
        stroke-dasharray: 3 2;
      }
      .ship {
        fill: #e8ecff;
        stroke: #ff9f6b;
      }
      .planet {
        fill: #2a4a8a;
        stroke: #8ac7ff;
        stroke-width: 1.4;
      }
      .beam {
        stroke: #6dff9b;
        stroke-width: 2;
        filter: drop-shadow(0 0 4px #6dff9b);
        animation: pulse 2.4s ease-in-out infinite;
        &.late {
          animation-delay: 1.2s;
        }
      }
      .blink {
        fill: #ffd23f;
        animation: blink 1.4s steps(2) infinite;
        &.red {
          fill: #ff3b3b;
        }
      }
      &.still * {
        animation: none !important;
      }
    }
    @keyframes blink {
      50% {
        opacity: 0.2;
      }
    }
    @keyframes pulse {
      50% {
        opacity: 0.35;
      }
    }
    @keyframes rise {
      from {
        transform: translateY(0);
        opacity: 0.6;
      }
      to {
        transform: translateY(-10px);
        opacity: 0;
      }
    }
  `,
})
export class ImprovementArt {
  readonly id = input.required<ImprovementId>();
  readonly size = input(48);
  readonly still = input(false);
}
