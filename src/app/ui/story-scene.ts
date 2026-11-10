import { Component, computed, inject, signal } from '@angular/core';
import { FINALE, FinaleChoice } from '../game/story-data';
import { AudioService } from '../services/audio.service';
import { GameService, SPEAKER_NAMES } from '../services/game.service';
import { SpeakerPortrait } from './speaker-portrait';

/**
 * A story episode, full screen: title card, then a visual-novel scene
 * (portrait + dialogue box, click to advance), and for the finale the
 * permanent choice between the two endings.
 */
@Component({
  selector: 'fdm-story-scene',
  imports: [SpeakerPortrait],
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    @if (game.scene(); as sc) {
      <div class="scene" [class.card]="sc.index < 0" role="dialog" [attr.aria-label]="sc.label + ' ' + sc.title">
        @if (sc.index < 0) {
          <div class="title-card" (click)="next()">
            <div class="stripe"></div>
            <div class="act">{{ sc.act }}</div>
            <div class="num">{{ sc.label }}</div>
            <div class="title">{{ sc.title }}</div>
            @if (sc.replay) {
              <div class="replay">REPLAY</div>
            }
            <div class="hint">CLICK TO BEGIN</div>
          </div>
        } @else if (line(); as l) {
          <div class="stage" (click)="next()">
            <div class="who-big">
              <fdm-speaker-portrait [speaker]="l[0]" [size]="220" />
            </div>
            <div class="box">
              <div class="name">{{ name(l[0]) }}</div>
              <p class="text">{{ l[1] }}</p>
              <div class="more">{{ sc.index + 1 }} / {{ sc.lines.length }} ▼</div>
            </div>
          </div>
        } @else {
          <div class="choice">
            <div class="choose-title">THE CYCLE <span class="kana">ループ</span></div>
            <p class="dim">This choice is permanent for this save.</p>
            <div class="doors">
              @for (f of finales; track f.id) {
                <button type="button" class="door" [class]="'door ' + f.id" [class.on]="picked() === f.id" (click)="pick(f.id)">
                  <span class="door-name">{{ f.name }}</span>
                  <span class="kana">{{ f.kana }}</span>
                  <span class="pitch">{{ f.pitch }}</span>
                  <ul>
                    @for (e of f.effects; track e) {
                      <li>{{ e }}</li>
                    }
                  </ul>
                </button>
              }
            </div>
            <button type="button" class="confirm" [disabled]="!picked()" (click)="confirm()">
              {{ picked() ? 'CONFIRM: ' + finale(picked()!).name.toUpperCase() : 'CHOOSE A DOOR' }}
            </button>
          </div>
        }
        @if (sc.index >= 0 && line()) {
          <button type="button" class="skip" (click)="skip($event)">{{ sc.finale ? 'SKIP TO CHOICE ▶▶' : 'SKIP ▶▶' }}</button>
        }
      </div>
    }
  `,
  styles: `
    .scene {
      position: fixed;
      inset: 0;
      z-index: 80;
      background:
        radial-gradient(ellipse at 30% 40%, rgba(199, 125, 255, 0.18), transparent 60%),
        linear-gradient(180deg, #070818 0%, #120a26 60%, #05060f 100%);
      color: var(--text);
      font-family: var(--font-mono);
      overflow: hidden;
    }
    .title-card {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      text-align: center;
      cursor: pointer;
      gap: 0.4rem;
    }
    .stripe {
      position: absolute;
      left: -10%;
      right: -10%;
      top: 44%;
      height: 120px;
      transform: rotate(-6deg);
      background: linear-gradient(90deg, #ff3d9a, #ff7a3d 60%, #ffd23f);
      opacity: 0.85;
      animation: sweep 0.7s ease-out;
    }
    @keyframes sweep {
      from {
        transform: rotate(-6deg) translateX(-100%);
      }
    }
    .act,
    .num,
    .title,
    .replay,
    .hint {
      position: relative;
    }
    .act {
      font-family: var(--font-display);
      letter-spacing: 0.4em;
      color: var(--cyan);
      font-size: 0.8rem;
    }
    .num {
      font-family: var(--font-display);
      letter-spacing: 0.3em;
      color: var(--amber);
    }
    .title {
      font-family: var(--font-logo);
      font-style: italic;
      font-size: clamp(2.2rem, 6vw, 4.5rem);
      color: #fff;
      text-shadow:
        3px 3px 0 #1a0a2e,
        0 0 24px rgba(255, 255, 255, 0.4);
      margin: 1.2rem 0;
    }
    .replay {
      color: var(--text-dim);
      letter-spacing: 0.3em;
      font-size: 0.7rem;
    }
    .hint {
      margin-top: 2rem;
      color: var(--text-dim);
      font-size: 0.7rem;
      letter-spacing: 0.3em;
      animation: blink 1.2s steps(2) infinite;
    }
    @keyframes blink {
      50% {
        opacity: 0.3;
      }
    }
    .stage {
      position: absolute;
      inset: 0;
      cursor: pointer;
    }
    .who-big {
      position: absolute;
      left: 8%;
      bottom: 210px;
      border: 2px solid #3a2f7a;
      box-shadow: 0 0 30px rgba(199, 125, 255, 0.35);
      animation: slide-in 0.25s ease-out;
    }
    @keyframes slide-in {
      from {
        transform: translateX(-30px);
        opacity: 0;
      }
    }
    .box {
      position: absolute;
      left: 6%;
      right: 6%;
      bottom: 40px;
      min-height: 140px;
      background: rgba(8, 10, 30, 0.92);
      border: 2px solid #6a4fd0;
      box-shadow:
        0 0 0 4px rgba(8, 10, 30, 0.6),
        0 0 24px rgba(106, 79, 208, 0.4);
      padding: 1rem 1.3rem 1.6rem;
    }
    .name {
      position: absolute;
      top: -16px;
      left: 18px;
      background: #6a4fd0;
      color: #fff;
      font-family: var(--font-display);
      letter-spacing: 0.15em;
      font-size: 0.78rem;
      padding: 0.2rem 0.8rem;
    }
    .text {
      margin: 0.6rem 0 0;
      font-size: 1.05rem;
      line-height: 1.5;
    }
    .more {
      position: absolute;
      right: 14px;
      bottom: 8px;
      font-size: 0.66rem;
      color: var(--text-dim);
      animation: blink 1s steps(2) infinite;
    }
    .skip {
      position: absolute;
      top: 16px;
      right: 16px;
      appearance: none;
      background: rgba(8, 10, 30, 0.8);
      border: 1px solid #3a2f7a;
      color: var(--text-dim);
      font-family: var(--font-display);
      font-size: 0.66rem;
      letter-spacing: 0.15em;
      padding: 0.35rem 0.7rem;
      cursor: pointer;
    }
    .choice {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      justify-items: center;
      gap: 0.8rem;
      padding: 1rem;
    }
    .choose-title {
      font-family: var(--font-logo);
      font-style: italic;
      font-size: 2.4rem;
      color: #fff;
      .kana {
        font-family: var(--font-kana);
        font-size: 1rem;
        color: var(--text-dim);
        font-style: normal;
      }
    }
    .dim {
      color: var(--text-dim);
      margin: 0;
    }
    .doors {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 340px));
      gap: 1rem;
    }
    .door {
      appearance: none;
      text-align: left;
      display: grid;
      gap: 0.4rem;
      align-content: start;
      padding: 1rem;
      color: var(--text);
      font-family: var(--font-mono);
      cursor: pointer;
      border: 2px solid;
      ul {
        margin: 0;
        padding-left: 1.1rem;
        font-size: 0.74rem;
        display: grid;
        gap: 0.2rem;
      }
      &.break {
        border-color: #ffd23f;
        background: linear-gradient(180deg, rgba(255, 210, 63, 0.16), rgba(8, 10, 30, 0.9));
      }
      &.master {
        border-color: #ff3b3b;
        background: linear-gradient(180deg, rgba(120, 10, 40, 0.4), rgba(8, 10, 30, 0.95));
      }
      &.on {
        box-shadow: 0 0 26px rgba(255, 255, 255, 0.35);
        transform: translateY(-3px);
      }
    }
    .door-name {
      font-family: var(--font-logo);
      font-style: italic;
      font-size: 1.4rem;
    }
    .door .kana {
      font-family: var(--font-kana);
      color: var(--text-dim);
      font-size: 0.75rem;
    }
    .pitch {
      font-size: 0.82rem;
    }
    .confirm {
      appearance: none;
      font-family: var(--font-logo);
      font-style: italic;
      letter-spacing: 0.1em;
      font-size: 1rem;
      padding: 0.7rem 1.6rem;
      color: #fff;
      background: linear-gradient(180deg, #ff5fae, #c41f6e);
      border: 2px solid #ffb0d8;
      cursor: pointer;
      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }
    @media (max-width: 720px) {
      .doors {
        grid-template-columns: minmax(0, 1fr);
      }
      .who-big {
        display: none;
      }
    }
  `,
})
export class StoryScene {
  protected readonly game = inject(GameService);
  private readonly audio = inject(AudioService);
  protected readonly finales = [FINALE.break, FINALE.master];
  protected readonly picked = signal<FinaleChoice | null>(null);

  protected readonly line = computed(() => {
    const sc = this.game.scene();
    return sc && sc.index >= 0 && sc.index < sc.lines.length ? sc.lines[sc.index] : null;
  });

  protected name(who: string): string {
    if (who === 'JACKAL') return 'THE VERMILION JACKAL';
    return SPEAKER_NAMES[who as keyof typeof SPEAKER_NAMES] ?? who;
  }

  protected finale(id: FinaleChoice) {
    return FINALE[id];
  }

  protected next(): void {
    this.game.advanceScene();
  }

  protected skip(e: Event): void {
    e.stopPropagation();
    this.audio.blip();
    this.game.skipScene();
  }

  protected pick(id: FinaleChoice): void {
    this.audio.select();
    this.picked.set(id);
  }

  protected confirm(): void {
    const c = this.picked();
    if (!c) return;
    this.picked.set(null);
    this.game.chooseFinale(c);
  }

  protected onKey(e: KeyboardEvent): void {
    const sc = this.game.scene();
    if (!sc) return;
    if (e.key === ' ' || e.key === 'Enter') {
      if (sc.index < sc.lines.length) {
        e.preventDefault();
        this.next();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.game.skipScene();
    }
  }
}
