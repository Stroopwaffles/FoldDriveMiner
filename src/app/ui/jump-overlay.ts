import { Component, computed, inject } from '@angular/core';
import { GameService } from '../services/game.service';

/**
 * The Fold Jump cinematic: klaxon and arming banner, the fleet's farewell,
 * a countdown, a warp tunnel and a white flash (the episode card follows).
 */
@Component({
  selector: 'fdm-jump-overlay',
  template: `
    @if (game.jump(); as j) {
      <div class="jump" [class]="'jump ' + j.phase + ' ' + ending()" role="alert">
        @switch (j.phase) {
          @case ('arm') {
            <div class="stripes"></div>
            <div class="arm">
              <div class="arm-title">FOLD DRIVE ARMED</div>
              <div class="arm-sub">ALL HANDS TO CORE</div>
              <div class="kana">フォールドドライブ・きどう</div>
            </div>
            <div class="stripes bottom"></div>
          }
          @case ('farewell') {
            <div class="farewell">
              <div class="fleet" aria-hidden="true">
                @for (i of formation; track i) {
                  <span [style.--i]="i" [style.--row]="(i % 3) - 1"></span>
                }
              </div>
              <p>The fleet holds formation outside the fold field.</p>
              <p class="dim">Everything beyond the core hull stays behind in {{ j.from }}.</p>
            </div>
          }
          @case ('countdown') {
            <div class="count">{{ j.count }}</div>
            <div class="to">DESTINATION · {{ j.to }}</div>
          }
          @case ('tunnel') {
            <div class="tunnel" aria-hidden="true">
              @for (i of streaks; track i) {
                <span [style.--a]="i * 15 + 'deg'" [style.--d]="(i % 5) * 0.12 + 's'"></span>
              }
            </div>
            <div class="folding">FOLDING…</div>
          }
          @case ('flash') {
            <div class="flash"></div>
          }
        }
      </div>
    }
  `,
  styles: `
    .jump {
      position: fixed;
      inset: 0;
      z-index: 90;
      background: #05060f;
      display: grid;
      place-items: center;
      overflow: hidden;
      font-family: var(--font-display);
      color: var(--text);
    }
    .jump.arm {
      background: #1a0508;
      animation: alarm 0.5s steps(2) infinite;
    }
    @keyframes alarm {
      50% {
        background: #3a0a10;
      }
    }
    .stripes {
      position: absolute;
      left: 0;
      right: 0;
      top: 18%;
      height: 26px;
      background: repeating-linear-gradient(-45deg, var(--warn) 0 18px, #05060f 18px 36px);
      animation: slide 0.6s linear infinite;
      &.bottom {
        top: auto;
        bottom: 18%;
      }
    }
    @keyframes slide {
      to {
        background-position: 51px 0;
      }
    }
    .arm {
      text-align: center;
    }
    .arm-title {
      font-family: var(--font-logo);
      font-style: italic;
      font-size: clamp(2rem, 6vw, 4.5rem);
      color: var(--danger);
      text-shadow: 0 0 24px var(--danger);
    }
    .arm-sub {
      letter-spacing: 0.4em;
      font-size: clamp(1rem, 2vw, 1.5rem);
      color: var(--warn);
      margin-top: 0.5rem;
    }
    .kana {
      font-family: var(--font-kana);
      color: var(--text-dim);
      margin-top: 0.8rem;
      letter-spacing: 0.3em;
    }
    .farewell {
      text-align: center;
      font-family: var(--font-mono);
      p {
        margin: 0.3rem 0;
      }
      .dim {
        color: var(--text-dim);
      }
    }
    .fleet {
      position: relative;
      height: 120px;
      width: 320px;
      margin: 0 auto 1rem;
      span {
        position: absolute;
        left: calc(50% + (var(--i) - 4) * 34px);
        top: calc(50% + var(--row) * 26px);
        width: 14px;
        height: 14px;
        background: var(--cyan);
        transform: rotate(45deg);
        box-shadow: 0 0 10px var(--cyan);
        animation: drift 2.6s ease-in forwards;
        animation-delay: calc(var(--i) * 0.08s);
      }
    }
    @keyframes drift {
      to {
        transform: rotate(45deg) translate(-60px, 60px);
        opacity: 0.15;
      }
    }
    .count {
      font-family: var(--font-logo);
      font-size: clamp(6rem, 18vw, 12rem);
      color: #c77dff;
      text-shadow: 0 0 40px #c77dff;
      animation: count 1s ease-out;
    }
    @keyframes count {
      from {
        transform: scale(1.8);
        opacity: 0;
      }
    }
    .to {
      position: absolute;
      bottom: 18%;
      letter-spacing: 0.3em;
      color: var(--cyan);
    }
    .tunnel {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle, #fff 0%, #c77dff 6%, #2a0a5a 30%, #05060f 70%);
      span {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 3px;
        height: 45vmax;
        transform-origin: 50% 0;
        transform: rotate(var(--a));
        background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.9));
        animation: streak 0.6s linear infinite;
        animation-delay: var(--d);
      }
    }
    @keyframes streak {
      from {
        opacity: 0;
        transform: rotate(var(--a)) scaleY(0.2);
      }
      to {
        opacity: 1;
        transform: rotate(var(--a)) scaleY(1.2);
      }
    }
    .break .tunnel {
      background: radial-gradient(circle, #fff 0%, #ffe08a 8%, #ff9a5a 30%, #1d2a5a 75%);
    }
    .master .tunnel {
      background: radial-gradient(circle, #fff 0%, #ff3b3b 6%, #3a0010 32%, #000 70%);
    }
    .folding {
      position: relative;
      font-family: var(--font-logo);
      letter-spacing: 0.5em;
      color: #fff;
      text-shadow: 0 0 20px #c77dff;
    }
    .flash {
      position: absolute;
      inset: 0;
      background: #fff;
      animation: flash 0.7s ease-out forwards;
    }
    @keyframes flash {
      to {
        opacity: 0;
      }
    }
  `,
})
export class JumpOverlay {
  protected readonly game = inject(GameService);
  protected readonly ending = computed(() => this.game.state()?.story.choice ?? '');
  protected readonly formation = Array.from({ length: 9 }, (_, i) => i);
  protected readonly streaks = Array.from({ length: 24 }, (_, i) => i);
}
