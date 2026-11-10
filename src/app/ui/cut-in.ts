import { Component, DestroyRef, effect, inject } from '@angular/core';
import { GameService } from '../services/game.service';
import { SettingsService } from '../services/settings.service';
import { PilotPortrait } from './pilot-portrait';

/**
 * Full-screen Special Technique cut-in: speed lines, an eye close-up of the
 * pilot, and the technique's name slashed across the screen.
 */
@Component({
  selector: 'fdm-cut-in',
  imports: [PilotPortrait],
  template: `
    @if (game.cutIn(); as c) {
      <div class="cut-in" [style.--c]="c.color" (click)="close()" role="dialog" [attr.aria-label]="c.technique">
        <div class="speed-lines"></div>
        <div class="band top"></div>
        <div class="eyes">
          <fdm-pilot-portrait [seed]="c.seed" [story]="c.story" [eyes]="true" />
        </div>
        <div class="band bottom"></div>
        <div class="shout">"{{ c.callsign }}, GO!"</div>
        <div class="name">
          <span class="kana">ひっさつわざ</span>
          <span class="tech">{{ c.technique }}!</span>
        </div>
        <div class="flash"></div>
      </div>
    }
  `,
  styles: `
    .cut-in {
      position: fixed;
      inset: 0;
      z-index: 80;
      overflow: hidden;
      background: #05060f;
      cursor: pointer;
      animation: hold 2.6s linear forwards;
    }

    .speed-lines {
      position: absolute;
      inset: -50%;
      background: repeating-conic-gradient(from 0deg, rgba(255, 255, 255, 0.85) 0deg 1.2deg, transparent 1.2deg 7deg);
      -webkit-mask-image: radial-gradient(circle, transparent 18%, #000 45%);
      mask-image: radial-gradient(circle, transparent 18%, #000 45%);
      animation: spin 0.25s linear infinite;
      opacity: 0.5;
    }

    .band {
      position: absolute;
      left: -10%;
      right: -10%;
      height: 26%;
      background: var(--c);
      transform: skewY(-8deg);
      z-index: 2;
    }

    .band.top {
      top: 6%;
      animation: from-left 0.25s ease-out both;
    }

    .band.bottom {
      bottom: 6%;
      animation: from-right 0.25s ease-out both;
    }

    /* The portrait is drawn huge and cropped to the eye line. */
    .eyes {
      position: absolute;
      left: 0;
      right: 0;
      top: 32%;
      height: 30%;
      overflow: hidden;
      z-index: 3;
      transform: skewY(-8deg);
      border-top: 4px solid #05060f;
      border-bottom: 4px solid #05060f;
      animation: zoom 0.35s 0.1s ease-out both;
      filter: contrast(1.15) saturate(1.2);
    }

    .shout {
      position: absolute;
      left: 6vw;
      top: 12%;
      z-index: 4;
      font-family: var(--font-display);
      font-size: clamp(1.2rem, 3vw, 2.4rem);
      color: #05060f;
      transform: skewY(-8deg);
      animation: from-left 0.3s 0.15s ease-out both;
    }

    .name {
      position: absolute;
      right: 5vw;
      bottom: 11%;
      z-index: 4;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      transform: skewY(-8deg) skewX(-12deg);
      animation: slam 0.35s 0.45s cubic-bezier(0.2, 0.9, 0.2, 1.2) both;
    }

    .tech {
      font-family: var(--font-logo);
      font-size: clamp(2rem, 6vw, 5rem);
      color: #fff;
      -webkit-text-stroke: 2px #05060f;
      text-shadow:
        5px 5px 0 #05060f,
        0 0 30px var(--c);
      text-align: right;
      line-height: 1;
    }

    .kana {
      font-family: var(--font-kana);
      color: #05060f;
      font-size: clamp(0.9rem, 1.6vw, 1.3rem);
      letter-spacing: 0.3em;
    }

    .flash {
      position: absolute;
      inset: 0;
      background: #fff;
      z-index: 5;
      pointer-events: none;
      animation: flash 0.4s 0.45s ease-out both;
    }

    @keyframes spin {
      to {
        rotate: 7deg;
      }
    }
    @keyframes from-left {
      from {
        translate: -110% 0;
      }
    }
    @keyframes from-right {
      from {
        translate: 110% 0;
      }
    }
    @keyframes zoom {
      from {
        opacity: 0;
        scale: 1.4;
      }
    }
    @keyframes slam {
      from {
        opacity: 0;
        translate: 30vw 0;
      }
    }
    @keyframes flash {
      0% {
        opacity: 0;
      }
      20% {
        opacity: 0.9;
      }
      100% {
        opacity: 0;
      }
    }
    @keyframes hold {
      0%,
      88% {
        opacity: 1;
      }
      100% {
        opacity: 0;
      }
    }
  `,
})
export class CutIn {
  protected readonly game = inject(GameService);
  private readonly settings = inject(SettingsService);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      if (this.game.cutIn()) {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => this.close(), this.settings.settings().cutIns === 'short' ? 1300 : 2600);
      }
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
  }

  protected close(): void {
    this.game.cutIn.set(null);
  }
}
