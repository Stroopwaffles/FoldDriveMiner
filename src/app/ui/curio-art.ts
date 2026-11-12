import { Component, input } from '@angular/core';

/** A small hand-drawn sketch of a curio for the Codex (or a sealed crate if not yet found). */
@Component({
  selector: 'fdm-curio-art',
  template: `
    <svg viewBox="0 0 64 64" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
      <rect width="64" height="64" rx="4" class="bg" />
      @if (!found()) {
        <!-- A sealed crate. -->
        <rect x="16" y="20" width="32" height="26" class="dim" />
        <line x1="16" y1="28" x2="48" y2="28" class="dim" />
        <text x="32" y="42" text-anchor="middle" class="q">?</text>
      } @else {
        @switch (id()) {
          @case ('halcyon_plate') {
            <polygon points="12,18 50,12 54,46 18,52 10,34" class="metal" />
            <circle cx="16" cy="22" r="1.6" class="rivet" />
            <circle cx="48" cy="17" r="1.6" class="rivet" />
            <circle cx="50" cy="42" r="1.6" class="rivet" />
            <circle cx="20" cy="47" r="1.6" class="rivet" />
            <text x="32" y="32" text-anchor="middle" class="stamp">HALCYON</text>
            <text x="32" y="40" text-anchor="middle" class="stamp">HULL 6</text>
            <path d="M40 46 Q46 38 52 40" class="scorch" />
          }
          @case ('stopped_watch') {
            <rect x="27" y="6" width="10" height="7" rx="2" class="metal" />
            <circle cx="32" cy="35" r="20" class="metal" />
            <circle cx="32" cy="35" r="16" class="face" />
            @for (a of ticks; track a) {
              <line x1="32" y1="21" x2="32" y2="24" class="tick" [attr.transform]="'rotate(' + a + ' 32 35)'" />
            }
            <line x1="32" y1="35" x2="32" y2="24" class="hand" transform="rotate(-24 32 35)" />
            <line x1="32" y1="35" x2="40" y2="35" class="hand thin" />
            <text x="32" y="47" text-anchor="middle" class="tiny">−0:04</text>
          }
          @case ('beacon_shard') {
            <polygon points="32,6 44,26 38,58 24,52 20,24" class="crystal" />
            <polyline points="32,6 30,30 38,58" class="facet" />
            <polyline points="20,24 30,30 44,26" class="facet" />
            <circle cx="30" cy="30" r="9" class="glow" />
          }
          @case ('twin_wrench') {
            <g transform="rotate(-40 32 32)">
              <rect x="28" y="16" width="8" height="38" rx="3" class="metal" />
              <path d="M22 8 h20 v10 h-6 v-4 h-8 v4 h-6 z" class="metal" />
              <text x="32" y="42" text-anchor="middle" class="stamp" transform="rotate(90 32 40)">K.O.</text>
            </g>
          }
          @case ('sealed_letter') {
            <rect x="8" y="16" width="48" height="32" class="paper" />
            <polyline points="8,16 32,36 56,16" class="fold" />
            <circle cx="32" cy="36" r="5" class="seal" />
            <path d="M14 42 q4 -3 8 0 t8 0" class="ink" />
          }
          @case ('mech_optic') {
            <rect x="8" y="20" width="48" height="24" rx="5" class="metal" />
            <rect x="14" y="27" width="36" height="10" rx="3" class="visor" />
            <line x1="24" y1="27" x2="20" y2="37" class="crack" />
            <path d="M6 30 l-3 -4 M6 36 l-4 2 M58 32 l4 -3" class="wire" />
          }
          @case ('tithe_beads') {
            <path d="M14 14 Q32 62 50 14" class="cord" />
            @for (b of beads; track $index) {
              <rect [attr.x]="b.x - 3" [attr.y]="b.y - 3" width="6" height="6" class="chip" />
            }
            <circle cx="32" cy="10" r="4" class="knot" />
          }
          @case ('meridian_badge') {
            <rect x="14" y="8" width="36" height="50" rx="3" class="badge" />
            <rect x="26" y="4" width="12" height="7" rx="2" class="metal" />
            <rect x="21" y="16" width="22" height="18" class="photo" />
            <circle cx="32" cy="23" r="4" class="ink-fill" />
            <path d="M24 33 q8 -8 16 0" class="ink-fill" />
            <text x="32" y="42" text-anchor="middle" class="tiny dark">MERIDIAN</text>
            <rect x="20" y="46" width="24" height="3" class="bar" />
          }
          @case ('vermilion_fang') {
            <path d="M18 8 Q32 18 46 8" class="chain" />
            <path d="M26 16 Q32 20 38 16 L33 54 Q32 56 31 54 Z" class="fang" />
            <path d="M30 20 L31 46" class="shine" />
          }
          @case ('frozen_seed') {
            <rect x="20" y="6" width="24" height="52" rx="8" class="vial" />
            <rect x="20" y="6" width="24" height="8" rx="3" class="metal" />
            <ellipse cx="32" cy="36" rx="7" ry="11" class="seed" />
            <path d="M32 26 q4 10 0 20" class="seed-line" />
            <path d="M24 20 l3 3 M40 46 l-3 -3 M41 22 l-3 2" class="frost" />
          }
          @case ('eight_ships') {
            <rect x="6" y="8" width="52" height="48" class="paper" />
            @for (p of ships; track $index) {
              <polygon [attr.points]="p.x + ',' + p.y + ' ' + (p.x + 8) + ',' + (p.y + 3) + ' ' + p.x + ',' + (p.y + 6)" class="ship" />
              @if (!p.last) {
                <line [attr.x1]="p.x - 1" [attr.y1]="p.y - 1" [attr.x2]="p.x + 9" [attr.y2]="p.y + 7" class="cross" />
              }
            }
            <circle cx="44" cy="44" r="7" class="circle" />
          }
          @case ('music_box') {
            <rect x="10" y="26" width="40" height="26" rx="2" class="wood" />
            <polygon points="10,26 16,12 56,12 50,26" class="wood lid" />
            <line x1="50" y1="40" x2="58" y2="40" class="metal-line" />
            <rect x="56" y="34" width="3" height="12" class="metal" />
            <text x="22" y="10" class="note">♪</text>
            <text x="36" y="7" class="note">♫</text>
          }
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
      .bg {
        fill: #0a0d22;
        stroke: #2a3168;
      }
      .dim {
        fill: none;
        stroke: #3a4178;
        stroke-width: 1.5;
      }
      .q {
        fill: #3a4178;
        font: 14px var(--font-display);
      }
      .metal {
        fill: #59639e;
        stroke: #c0c8d8;
        stroke-width: 1;
      }
      .metal-line {
        stroke: #c0c8d8;
        stroke-width: 2;
      }
      .rivet {
        fill: #c0c8d8;
      }
      .stamp {
        fill: #10132b;
        font: bold 6px var(--font-mono);
      }
      .scorch {
        fill: none;
        stroke: #1a1020;
        stroke-width: 3;
        opacity: 0.7;
      }
      .face {
        fill: #e8ecff;
      }
      .tick {
        stroke: #10132b;
        stroke-width: 1;
      }
      .hand {
        stroke: #ff3b3b;
        stroke-width: 2;
        stroke-linecap: round;
        &.thin {
          stroke: #10132b;
          stroke-width: 1;
        }
      }
      .tiny {
        fill: #ff3b3b;
        font: 5px var(--font-mono);
        &.dark {
          fill: #ffb547;
        }
      }
      .crystal {
        fill: rgba(109, 255, 240, 0.25);
        stroke: #6dfff0;
        stroke-width: 1.4;
      }
      .facet {
        fill: none;
        stroke: rgba(109, 255, 240, 0.6);
      }
      .glow {
        fill: rgba(109, 255, 240, 0.25);
        filter: blur(3px);
      }
      .paper {
        fill: #e8dcc0;
        stroke: #8a7a5a;
      }
      .fold {
        fill: none;
        stroke: #8a7a5a;
      }
      .seal {
        fill: #c41f3e;
      }
      .ink {
        fill: none;
        stroke: #2a2f55;
      }
      .visor {
        fill: #ff3b3b;
        filter: drop-shadow(0 0 3px #ff3b3b);
      }
      .crack {
        stroke: #05060f;
        stroke-width: 1.5;
      }
      .wire {
        stroke: #ffd23f;
        fill: none;
      }
      .cord {
        fill: none;
        stroke: #9aa3c7;
      }
      .chip {
        fill: #2a2f55;
        stroke: #6dff9b;
      }
      .knot {
        fill: #9aa3c7;
      }
      .badge {
        fill: #15193a;
        stroke: #ffb547;
      }
      .photo {
        fill: #8a9ac7;
      }
      .ink-fill {
        fill: #2a2f55;
      }
      .bar {
        fill: #ffb547;
      }
      .chain {
        fill: none;
        stroke: #c0c8d8;
        stroke-dasharray: 2 1.5;
      }
      .fang {
        fill: #ff3b3b;
        stroke: #8a1f2a;
      }
      .shine {
        stroke: #ffb0b0;
        stroke-width: 1;
      }
      .vial {
        fill: rgba(168, 220, 255, 0.2);
        stroke: #a8dcff;
      }
      .seed {
        fill: #8a5a2c;
        stroke: #c08a4a;
      }
      .seed-line {
        fill: none;
        stroke: #5a3a1c;
      }
      .frost {
        stroke: #e8f6ff;
        stroke-width: 1.2;
      }
      .ship {
        fill: #2a2f55;
      }
      .cross {
        stroke: #c41f3e;
        stroke-width: 1.2;
      }
      .circle {
        fill: none;
        stroke: #c41f3e;
        stroke-width: 1.4;
      }
      .wood {
        fill: #7a4a2a;
        stroke: #c08a4a;
        &.lid {
          fill: #8a5a32;
        }
      }
      .note {
        fill: #ffd23f;
        font-size: 9px;
      }
    }
  `,
})
export class CurioArt {
  readonly id = input.required<string>();
  readonly found = input(true);
  readonly size = input(64);

  protected readonly ticks = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  protected readonly beads = Array.from({ length: 7 }, (_, i) => {
    const t = (i + 1) / 8;
    // Points along the cord's curve.
    const x = (1 - t) ** 2 * 14 + 2 * (1 - t) * t * 32 + t ** 2 * 50;
    const y = (1 - t) ** 2 * 14 + 2 * (1 - t) * t * 62 + t ** 2 * 14;
    return { x, y };
  });
  protected readonly ships = [
    { x: 10, y: 12, last: false },
    { x: 26, y: 14, last: false },
    { x: 42, y: 12, last: false },
    { x: 12, y: 28, last: false },
    { x: 30, y: 30, last: false },
    { x: 46, y: 26, last: false },
    { x: 16, y: 44, last: false },
    { x: 40, y: 41, last: true },
  ];
}
