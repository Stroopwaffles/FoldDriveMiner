import { Component, inject } from '@angular/core';
import { NumberFormat } from '../game/format';
import { AudioService } from '../services/audio.service';
import { MusicService } from '../services/music.service';
import { Settings, SettingsService } from '../services/settings.service';

@Component({
  selector: 'fdm-settings-panel',
  template: `
    @let s = settings.settings();
    <div class="rows">
      <label class="row">
        <span>SFX volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          [value]="s.sfxVolume"
          (input)="setVolume($event)"
          (change)="audio.blip()"
        />
        <span class="val">{{ (s.sfxVolume * 100).toFixed(0) }}%</span>
      </label>

      <label class="row">
        <span>Music</span>
        <input type="checkbox" [checked]="s.music" (change)="patch({ music: !s.music })" />
        <span class="val">{{ s.music ? 'ON' : 'OFF' }}</span>
      </label>

      <label class="row">
        <span>Music volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          [value]="s.musicVolume"
          [disabled]="!s.music"
          (input)="setMusicVolume($event)"
        />
        <span class="val">{{ (s.musicVolume * 100).toFixed(0) }}%</span>
      </label>

      <label class="row">
        <span>Track</span>
        <select [value]="s.musicTrack" [disabled]="!s.music" (change)="setTrack($event)">
          <option value="auto" [selected]="s.musicTrack === 'auto'">Playlist — all tracks</option>
          @for (t of music.tracks; track t.id) {
            <option [value]="t.id" [selected]="s.musicTrack === t.id">{{ t.name }}</option>
          }
        </select>
        <button type="button" class="btn skip" [disabled]="!s.music" (click)="music.next(); audio.blip()" title="Next track">⏭</button>
      </label>
      @if (s.music) {
        <div class="now">♪ NOW PLAYING: <b>{{ music.nowPlaying().name }}</b><span>&nbsp;— {{ music.nowPlaying().mood }}</span></div>
      }

      <label class="row">
        <span>CRT scanlines</span>
        <input type="checkbox" [checked]="s.crt" (change)="patch({ crt: !s.crt })" />
        <span class="val">{{ s.crt ? 'ON' : 'OFF' }}</span>
      </label>

      <div class="row">
        <span>Reduced motion</span>
        <div class="seg">
          @for (opt of motionOpts; track opt) {
            <button
              type="button"
              class="btn"
              [class.on]="s.reducedMotion === opt"
              (click)="patch({ reducedMotion: opt })"
            >
              {{ opt }}
            </button>
          }
        </div>
      </div>

      <div class="row">
        <span>Numbers</span>
        <div class="seg">
          @for (opt of formatOpts; track opt.id) {
            <button
              type="button"
              class="btn"
              [class.on]="s.numberFormat === opt.id"
              (click)="patch({ numberFormat: opt.id })"
            >
              {{ opt.label }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .rows {
      display: grid;
      gap: 0.9rem;
      padding: 1rem;
    }
    .row {
      display: grid;
      grid-template-columns: 9rem 1fr auto;
      align-items: center;
      gap: 0.8rem;
      color: var(--text);
    }
    .val {
      color: var(--cyan);
      min-width: 3rem;
      text-align: right;
    }
    .seg {
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;
    }
    .seg .btn {
      font-size: 0.68rem;
      padding: 0.3rem 0.55rem;
    }
    .seg .btn.on {
      border-color: var(--amber);
      color: var(--amber);
    }
    input[type='range'] {
      accent-color: var(--magenta);
    }
    select {
      font-family: var(--font-mono);
      background: #060818;
      color: var(--text);
      border: 1px solid var(--bezel-hi);
      padding: 0.25rem 0.35rem;
    }
    .skip {
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
    }
    .now {
      margin-top: -0.4rem;
      font-size: 0.75rem;
      color: var(--magenta);
      b {
        font-weight: normal;
        color: var(--text);
      }
      span {
        color: var(--text-dim);
      }
    }
    input[type='checkbox'] {
      accent-color: var(--magenta);
      width: 18px;
      height: 18px;
    }
  `,
})
export class SettingsPanel {
  protected readonly settings = inject(SettingsService);
  protected readonly audio = inject(AudioService);
  protected readonly music = inject(MusicService);

  protected readonly motionOpts: Settings['reducedMotion'][] = ['system', 'on', 'off'];
  protected readonly formatOpts: { id: NumberFormat; label: string }[] = [
    { id: 'suffix', label: '1.2K' },
    { id: 'scientific', label: '1.2e3' },
    { id: 'engineering', label: 'ENG' },
  ];

  protected patch(p: Partial<Settings>): void {
    this.settings.update(p);
    this.audio.blip();
  }

  protected setTrack(e: Event): void {
    this.settings.update({ musicTrack: (e.target as HTMLSelectElement).value });
    this.audio.blip();
  }

  protected setMusicVolume(e: Event): void {
    this.settings.update({ musicVolume: Number((e.target as HTMLInputElement).value) });
  }

  protected setVolume(e: Event): void {
    this.settings.update({ sfxVolume: Number((e.target as HTMLInputElement).value) });
  }
}
