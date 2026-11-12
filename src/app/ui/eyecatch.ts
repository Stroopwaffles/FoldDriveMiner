import { Component, inject } from '@angular/core';
import { GameService } from '../services/game.service';

/**
 * The mid-run eyecatch: an 80s-anime "we'll be right back" card. Click to dismiss.
 * Plays every 15 minutes of play. Three looks, taken in turn so each card differs from the last:
 *  0 · the ship flying past a striped wipe (the original)
 *  1 · a mech on a sunset horizon, split-screen
 *  2 · VESPER on a CRT, "stand by"
 */
@Component({
  selector: 'fdm-eyecatch',
  template: `
    @if (game.eyecatch()) {
      @switch (game.eyecatchVariant()) {
        @case (1) {
          <div class="eyecatch mech-card" role="presentation" (click)="game.eyecatch.set(false)">
            <div class="half left"></div>
            <div class="half right"></div>
            <div class="sun" aria-hidden="true"></div>
            <div class="horizon" aria-hidden="true"></div>
            <svg class="mech" viewBox="0 0 120 150" aria-hidden="true">
              <!-- An original mining-mech silhouette: blocky torso, drill arm, square head. -->
              <rect x="44" y="18" width="32" height="24" rx="3" />
              <rect x="50" y="26" width="20" height="5" class="visor" />
              <polygon points="30,44 90,44 96,88 24,88" />
              <rect x="10" y="48" width="18" height="38" rx="4" />
              <rect x="92" y="48" width="18" height="30" rx="4" />
              <polygon points="92,78 110,78 101,104" class="drill" />
              <rect x="34" y="88" width="20" height="46" rx="3" />
              <rect x="66" y="88" width="20" height="46" rx="3" />
              <rect x="28" y="132" width="30" height="10" rx="2" />
              <rect x="62" y="132" width="30" height="10" rx="2" />
            </svg>
            <div class="caption">
              <div class="logo">FOLD DRIVE MINER</div>
              <div class="kana">フォールドドライブ・マイナー</div>
            </div>
          </div>
        }
        @case (2) {
          <div class="eyecatch crt-card" role="presentation" (click)="game.eyecatch.set(false)">
            <div class="crt">
              <svg class="vesper" viewBox="0 0 100 100" aria-hidden="true">
                <polygon points="50,6 94,50 50,94 6,50" />
                <circle cx="50" cy="50" r="22" />
                <circle cx="50" cy="50" r="9" class="pupil" />
              </svg>
              <div class="type">VESPER · STAND BY</div>
              <div class="logo">FOLD DRIVE<br />MINER</div>
              <div class="kana">このあとすぐ！</div>
              <div class="bars" aria-hidden="true">
                @for (c of bars; track c) {
                  <span [style.background]="c"></span>
                }
              </div>
            </div>
          </div>
        }
        @default {
          <div class="eyecatch ship-card" role="presentation" (click)="game.eyecatch.set(false)">
            <div class="wipe"></div>
            <div class="content">
              <svg class="ship" viewBox="0 0 200 80" aria-hidden="true">
                <polygon points="10,40 60,22 150,18 190,40 150,62 60,58" fill="#070818" stroke="#ffd23f" stroke-width="2" />
                <polygon points="60,22 90,6 120,18" fill="#070818" stroke="#ff3d9a" stroke-width="2" />
                <polygon points="60,58 90,74 120,62" fill="#070818" stroke="#ff3d9a" stroke-width="2" />
                <circle cx="160" cy="40" r="6" fill="#4fe3ff" />
              </svg>
              <div class="logo">FOLD DRIVE<br />MINER</div>
              <div class="kana">フォールドドライブ・マイナー</div>
            </div>
          </div>
        }
      }
    }
  `,
  styles: `
    .eyecatch {
      position: fixed;
      inset: 0;
      z-index: 85;
      display: grid;
      place-items: center;
      background: #05060f;
      overflow: hidden;
      cursor: pointer;
      animation: ec-in 0.35s ease-out;
    }
    @keyframes ec-in {
      from {
        clip-path: polygon(0 0, 0 0, 0 100%, 0 100%);
      }
      to {
        clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
      }
    }
    .logo {
      font-family: var(--font-logo);
      font-style: italic;
      font-size: clamp(2rem, 6vw, 3.8rem);
      line-height: 1;
      color: #fff;
      text-shadow:
        3px 3px 0 #ff3d9a,
        6px 6px 0 #1a0a2e;
    }
    .kana {
      margin-top: 0.6rem;
      font-family: var(--font-kana);
      color: var(--amber);
      letter-spacing: 0.25em;
    }

    /* ---------- 0 · ship past a striped wipe ---------- */
    .wipe {
      position: absolute;
      inset: -20%;
      background: repeating-linear-gradient(-30deg, #ff3d9a 0 60px, #ff7a3d 60px 120px, #ffd23f 120px 180px, #05060f 180px 300px);
      opacity: 0.85;
      animation: slide 3s linear;
    }
    @keyframes slide {
      to {
        transform: translateX(-180px);
      }
    }
    .content {
      position: relative;
      text-align: center;
      background: rgba(5, 6, 15, 0.92);
      border: 3px solid #fff;
      padding: 1.6rem 2.6rem;
      transform: rotate(-4deg);
      box-shadow: 10px 10px 0 #ff3d9a;
      animation: pop 0.5s 0.2s cubic-bezier(0.3, 1.6, 0.6, 1) both;
    }
    @keyframes pop {
      from {
        transform: rotate(-4deg) scale(0.4);
        opacity: 0;
      }
    }
    .ship {
      width: 180px;
      animation: fly 3s ease-in-out;
    }
    @keyframes fly {
      from {
        transform: translateX(-60px);
      }
      to {
        transform: translateX(40px);
      }
    }

    /* ---------- 1 · mech on a split sunset ---------- */
    .mech-card {
      animation: ec-in-down 0.35s ease-out;
    }
    @keyframes ec-in-down {
      from {
        clip-path: polygon(0 0, 100% 0, 100% 0, 0 0);
      }
      to {
        clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
      }
    }
    .half {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 50%;
    }
    .half.left {
      left: 0;
      background: linear-gradient(180deg, #2a0b3d, #ff3d9a);
      animation: from-left 0.5s ease-out both;
    }
    .half.right {
      right: 0;
      background: linear-gradient(180deg, #0b1a3d, #4fe3ff);
      animation: from-right 0.5s ease-out both;
    }
    @keyframes from-left {
      from {
        transform: translateX(-100%);
      }
    }
    @keyframes from-right {
      from {
        transform: translateX(100%);
      }
    }
    .sun {
      position: absolute;
      left: 50%;
      top: 58%;
      width: min(52vw, 52vh);
      aspect-ratio: 1;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      background: linear-gradient(180deg, #fff6c8, #ffd23f 45%, #ff7a3d 80%);
      -webkit-mask-image: linear-gradient(180deg, #000 0 55%, transparent 55% 59%, #000 59% 67%, transparent 67% 72%, #000 72% 80%, transparent 80% 86%, #000 86%);
      mask-image: linear-gradient(180deg, #000 0 55%, transparent 55% 59%, #000 59% 67%, transparent 67% 72%, #000 72% 80%, transparent 80% 86%, #000 86%);
      animation: sun-rise 3s ease-out both;
    }
    @keyframes sun-rise {
      from {
        transform: translate(-50%, -30%);
        opacity: 0.4;
      }
    }
    .horizon {
      position: absolute;
      left: 0;
      right: 0;
      top: 74%;
      bottom: 0;
      background: #05060f;
      border-top: 3px solid #ff3d9a;
      box-shadow: 0 -6px 24px rgba(255, 61, 154, 0.6);
    }
    .mech {
      position: absolute;
      left: 50%;
      bottom: 26%;
      height: min(46vh, 60vw);
      transform: translateX(-50%);
      fill: #05060f;
      filter: drop-shadow(0 0 2px #fff) drop-shadow(0 0 14px rgba(255, 61, 154, 0.7));
      animation: stride 3s ease-out both;

      .visor {
        fill: #ff3b3b;
        filter: drop-shadow(0 0 4px #ff3b3b);
      }

      .drill {
        fill: #2a2f55;
      }
    }
    @keyframes stride {
      from {
        transform: translateX(-50%) translateY(14%);
        opacity: 0;
      }
      30% {
        opacity: 1;
      }
    }
    .caption {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 6%;
      text-align: center;
      animation: pop-up 0.5s 0.6s cubic-bezier(0.3, 1.6, 0.6, 1) both;

      .logo {
        font-size: clamp(1.6rem, 5vw, 3.2rem);
      }
    }
    @keyframes pop-up {
      from {
        transform: translateY(40px);
        opacity: 0;
      }
    }

    /* ---------- 2 · VESPER on a CRT ---------- */
    .crt-card {
      background: #000;
    }
    .crt {
      position: relative;
      width: min(80vw, 560px);
      padding: 2rem 1.5rem 1.4rem;
      text-align: center;
      border-radius: 28px / 22px;
      background: radial-gradient(ellipse at 50% 45%, #0a2a30 0%, #04090c 75%);
      box-shadow:
        inset 0 0 60px rgba(0, 0, 0, 0.9),
        0 0 0 10px #15182c,
        0 0 0 12px #2a2f55,
        0 0 40px rgba(79, 227, 255, 0.25);
      overflow: hidden;
      animation: crt-on 0.6s ease-out both;

      /* Scanlines over everything. */
      &::after {
        content: '';
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.35) 0 1px, transparent 1px 3px);
        pointer-events: none;
      }
    }
    @keyframes crt-on {
      0% {
        transform: scale(1, 0.01);
        filter: brightness(3);
      }
      45% {
        transform: scale(1, 0.01);
      }
      100% {
        transform: scale(1, 1);
        filter: brightness(1);
      }
    }
    .vesper {
      width: 84px;
      fill: none;
      stroke: #4fe3ff;
      stroke-width: 3;
      filter: drop-shadow(0 0 8px #4fe3ff);
      animation: blink-eye 3s ease-in-out both;

      .pupil {
        fill: #4fe3ff;
      }
    }
    @keyframes blink-eye {
      0%,
      30% {
        opacity: 0;
      }
      40%,
      100% {
        opacity: 1;
      }
    }
    .type {
      margin: 0.6rem auto 0.8rem;
      width: max-content;
      max-width: 100%;
      font-family: var(--font-mono);
      color: #4fe3ff;
      letter-spacing: 0.2em;
      white-space: nowrap;
      overflow: hidden;
      border-right: 2px solid #4fe3ff;
      animation:
        typing 1.1s 0.7s steps(18, end) both,
        caret 0.7s steps(1) infinite;
    }
    @keyframes typing {
      from {
        width: 0;
      }
    }
    @keyframes caret {
      50% {
        border-color: transparent;
      }
    }
    .crt .logo {
      text-shadow:
        0 0 10px rgba(79, 227, 255, 0.8),
        3px 3px 0 #ff3d9a;
      animation: fade-in 0.4s 1.6s both;
    }
    .crt .kana {
      color: #ffd23f;
      animation: fade-in 0.4s 1.9s both;
    }
    @keyframes fade-in {
      from {
        opacity: 0;
      }
    }
    .bars {
      display: flex;
      height: 10px;
      margin-top: 1.1rem;

      span {
        flex: 1;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .eyecatch,
      .eyecatch * {
        animation-duration: 0.01s !important;
        animation-delay: 0s !important;
      }
    }
  `,
})
export class Eyecatch {
  protected readonly game = inject(GameService);
  /** Colour test bars along the bottom of the CRT. */
  protected readonly bars = ['#ffffff', '#ffd23f', '#4fe3ff', '#6dff9b', '#ff3d9a', '#ff3b3b', '#2a2f55'];
}
