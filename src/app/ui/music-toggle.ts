import { Component, computed, inject } from '@angular/core';
import { AudioService } from '../services/audio.service';
import { MusicService } from '../services/music.service';
import { SettingsService } from '../services/settings.service';

/** Small console switch that turns the background music on and off. */
@Component({
  selector: 'fdm-music-toggle',
  template: `
    <button
      type="button"
      class="music-btn"
      [class.on]="on()"
      [attr.aria-pressed]="on()"
      [attr.aria-label]="on() ? 'Turn music off' : 'Turn music on'"
      [title]="on() ? 'Music on (M) — ' + music.nowPlaying().name : 'Music off (M)'"
      (click)="toggle()"
    >
      <span class="eq" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </span>
      <span class="label">♪ {{ on() ? 'ON' : 'OFF' }}</span>
    </button>
    @if (on()) {
      <button type="button" class="skip-btn" (click)="skip()" [title]="'Next track (now: ' + music.nowPlaying().name + ')'" aria-label="Next track">⏭</button>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      gap: 4px;
    }
    .skip-btn {
      appearance: none;
      padding: 0.4rem 0.5rem;
      background: linear-gradient(180deg, var(--panel-hi), var(--panel));
      border: 2px solid var(--bezel-hi);
      border-radius: 3px;
      color: var(--magenta);
      font-size: 0.72rem;
      cursor: pointer;
      box-shadow: 0 3px 0 #070917;
      &:hover {
        border-color: var(--cyan);
      }
      &:active {
        transform: translateY(3px);
        box-shadow: none;
      }
    }
    .music-btn {
      appearance: none;
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.4rem 0.65rem;
      background: linear-gradient(180deg, var(--panel-hi), var(--panel));
      border: 2px solid var(--bezel-hi);
      border-radius: 3px;
      color: var(--text-dim);
      font-family: var(--font-display);
      font-size: 0.72rem;
      letter-spacing: 0.08em;
      cursor: pointer;
      box-shadow: 0 3px 0 #070917;
      white-space: nowrap;

      &:hover {
        border-color: var(--cyan);
      }

      &:active {
        transform: translateY(3px);
        box-shadow: none;
      }

      &.on {
        color: var(--magenta);
        border-color: var(--magenta);
      }
    }

    /* Little equalizer that dances while music plays */
    .eq {
      display: inline-flex;
      align-items: flex-end;
      gap: 2px;
      height: 12px;

      span {
        width: 3px;
        height: 3px;
        background: currentColor;
      }
    }

    .on .eq span {
      animation: eq 0.6s ease-in-out infinite alternate;
    }

    .on .eq span:nth-child(2) {
      animation-delay: -0.2s;
    }

    .on .eq span:nth-child(3) {
      animation-delay: -0.4s;
    }

    .on .eq span:nth-child(4) {
      animation-delay: -0.1s;
    }

    @keyframes eq {
      from {
        height: 3px;
      }
      to {
        height: 12px;
      }
    }
  `,
})
export class MusicToggle {
  protected readonly music = inject(MusicService);
  private readonly audio = inject(AudioService);
  private readonly settings = inject(SettingsService);

  protected readonly on = computed(() => this.settings.settings().music);

  protected skip(): void {
    this.music.next();
    this.audio.blip();
  }

  protected toggle(): void {
    this.audio.unlock();
    this.music.toggle();
    this.audio.blip();
  }
}
