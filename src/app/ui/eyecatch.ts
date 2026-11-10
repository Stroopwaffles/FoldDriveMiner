import { Component, inject } from '@angular/core';
import { GameService } from '../services/game.service';

/**
 * The mid-run eyecatch: an 80s-anime "we'll be right back" card with the
 * logo, a diagonal wipe and the ship's silhouette. Click to dismiss.
 */
@Component({
  selector: 'fdm-eyecatch',
  template: `
    @if (game.eyecatch()) {
      <div class="eyecatch" role="presentation" (click)="game.eyecatch.set(false)">
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
  `,
})
export class Eyecatch {
  protected readonly game = inject(GameService);
}
