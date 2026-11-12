import { Component, inject } from '@angular/core';
import { GameService } from '../services/game.service';
import { ImprovementArt } from './improvement-art';
import { PilotPortrait } from './pilot-portrait';

/**
 * Event eyecatch: a quick anime banner for big moments (a convoy arriving, an improvement
 * finished, the Jackal attacking, the pirate base destroyed, a new Codex entry). Click to dismiss.
 */
@Component({
  selector: 'fdm-event-catch',
  imports: [ImprovementArt, PilotPortrait],
  template: `
    @if (game.eventCatch(); as e) {
      <div class="catch" [class]="'catch ' + e.kind" [style.--ec]="e.color" role="status" [attr.aria-label]="e.title + '. ' + e.sub" (click)="game.dismissEventCatch()">
        <div class="band">
          <div class="stripes" aria-hidden="true"></div>
          <div class="emblem" aria-hidden="true">
            @switch (e.kind) {
              @case ('convoy') {
                <svg viewBox="0 0 120 60" class="ships">
                  @for (s of ships; track $index) {
                    <g [attr.transform]="'translate(' + s.x + ' ' + s.y + ') scale(' + s.k + ')'">
                      <polygon points="0,12 10,5 46,4 60,12 46,20 10,19" class="hull" />
                      <rect x="16" y="8" width="10" height="8" class="pod" />
                      <rect x="30" y="8" width="10" height="8" class="pod" />
                    </g>
                  }
                </svg>
              }
              @case ('build') {
                @if (e.improvement) {
                  <fdm-improvement-art [id]="e.improvement" [size]="92" />
                }
              }
              @case ('jackal') {
                <div class="portrait"><fdm-pilot-portrait story="jackal" [size]="92" /></div>
              }
              @case ('strike') {
                <svg viewBox="0 0 100 100" class="boom">
                  <circle cx="50" cy="50" r="30" class="core" />
                  @for (a of rays; track a) {
                    <line x1="50" y1="50" [attr.x2]="50 + 46 * cos(a)" [attr.y2]="50 + 46 * sin(a)" class="ray" />
                  }
                </svg>
              }
              @default {
                <svg viewBox="0 0 100 100" class="codex">
                  <polygon points="50,6 94,50 50,94 6,50" class="frame" />
                  <polygon points="50,24 76,50 50,76 24,50" class="gem" />
                </svg>
              }
            }
          </div>
          <div class="text">
            <div class="kicker">{{ e.kicker }}</div>
            <div class="title">{{ e.title }}</div>
            <div class="kana">{{ e.kana }}</div>
            <div class="sub">{{ e.sub }}</div>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .catch {
      position: fixed;
      inset: 0;
      z-index: 84;
      display: grid;
      align-items: center;
      background: rgba(5, 6, 15, 0.35);
      cursor: pointer;
      animation: fade 0.25s ease-out;
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
    .band {
      position: relative;
      display: flex;
      align-items: center;
      gap: 1.4rem;
      padding: 1rem 8vw;
      transform: skewY(-4deg);
      background: linear-gradient(90deg, rgba(5, 6, 15, 0.96), color-mix(in srgb, var(--ec) 28%, #05060f) 50%, rgba(5, 6, 15, 0.96));
      border-top: 3px solid var(--ec);
      border-bottom: 3px solid var(--ec);
      box-shadow: 0 0 40px color-mix(in srgb, var(--ec) 45%, transparent);
      overflow: hidden;
      animation: sweep 0.45s cubic-bezier(0.2, 1.3, 0.5, 1) both;

      > * {
        transform: skewY(4deg);
      }
    }
    @keyframes sweep {
      from {
        clip-path: inset(0 100% 0 0);
      }
      to {
        clip-path: inset(0 0 0 0);
      }
    }
    .stripes {
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(-60deg, transparent 0 22px, color-mix(in srgb, var(--ec) 12%, transparent) 22px 30px);
      animation: drift 3s linear infinite;
    }
    @keyframes drift {
      to {
        background-position: 120px 0;
      }
    }
    .emblem {
      position: relative;
      flex: none;
      width: 104px;
      display: grid;
      place-items: center;
      animation: pop 0.5s 0.2s cubic-bezier(0.3, 1.6, 0.6, 1) both;
    }
    @keyframes pop {
      from {
        transform: skewY(4deg) scale(0.3);
        opacity: 0;
      }
    }
    .text {
      position: relative;
      animation: slide 0.5s 0.15s ease-out both;
    }
    @keyframes slide {
      from {
        transform: skewY(4deg) translateX(40px);
        opacity: 0;
      }
    }
    .kicker {
      font-family: var(--font-display);
      font-size: 0.7rem;
      letter-spacing: 0.35em;
      color: var(--ec);
    }
    .title {
      font-family: var(--font-logo);
      font-style: italic;
      font-size: clamp(1.5rem, 4.5vw, 2.8rem);
      line-height: 1.05;
      color: #fff;
      text-shadow:
        3px 3px 0 color-mix(in srgb, var(--ec) 70%, #000),
        0 0 18px color-mix(in srgb, var(--ec) 50%, transparent);
    }
    .kana {
      font-family: var(--font-kana);
      color: var(--ec);
      letter-spacing: 0.2em;
      font-size: 0.8rem;
    }
    .sub {
      margin-top: 0.3rem;
      font-size: 0.82rem;
      color: var(--text);
      max-width: 52ch;
    }
    .ships {
      width: 110px;
      animation: hover 1.6s ease-in-out infinite;

      .hull {
        fill: #10142e;
        stroke: var(--ec);
        stroke-width: 1.6;
      }
      .pod {
        fill: color-mix(in srgb, var(--ec) 40%, #10142e);
      }
    }
    @keyframes hover {
      50% {
        transform: translateY(-4px);
      }
    }
    .portrait {
      border: 2px solid #ffd23f;
      box-shadow: 0 0 16px rgba(255, 59, 59, 0.7);
      line-height: 0;
    }
    .boom {
      width: 100px;

      .core {
        fill: #fff6c8;
        filter: drop-shadow(0 0 12px #ff7a3d);
        animation: flare 0.6s ease-out infinite alternate;
      }
      .ray {
        stroke: #ffd23f;
        stroke-width: 3;
        stroke-linecap: round;
      }
    }
    @keyframes flare {
      to {
        r: 36;
      }
    }
    .codex {
      width: 90px;

      .frame {
        fill: none;
        stroke: var(--ec);
        stroke-width: 3;
      }
      .gem {
        fill: var(--ec);
        filter: drop-shadow(0 0 10px var(--ec));
        animation: flare 1s ease-in-out infinite alternate;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .catch,
      .catch * {
        animation-duration: 0.01s !important;
        animation-delay: 0s !important;
        animation-iteration-count: 1 !important;
      }
    }
  `,
})
export class EventCatch {
  protected readonly game = inject(GameService);
  protected readonly ships = [
    { x: 8, y: 4, k: 1 },
    { x: 52, y: 22, k: 0.8 },
    { x: 0, y: 36, k: 0.65 },
  ];
  protected readonly rays = [0, 45, 90, 135, 180, 225, 270, 315];

  protected cos(deg: number): number {
    return Math.cos((deg * Math.PI) / 180);
  }
  protected sin(deg: number): number {
    return Math.sin((deg * Math.PI) / 180);
  }
}
