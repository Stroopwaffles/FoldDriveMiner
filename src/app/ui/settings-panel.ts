import { Component, computed, inject, signal } from '@angular/core';
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

      <label class="row">
        <span>Comm bleeps</span>
        <input type="checkbox" [checked]="s.commBleeps" (change)="patch({ commBleeps: !s.commBleeps })" />
        <span class="val">{{ s.commBleeps ? 'ON' : 'OFF' }}</span>
      </label>

      <label class="row">
        <span>Film grain</span>
        <input type="checkbox" [checked]="s.filmGrain" (change)="patch({ filmGrain: !s.filmGrain })" />
        <span class="val">{{ s.filmGrain ? 'ON' : 'OFF' }}</span>
      </label>

      <label class="row">
        <span>Screen shake</span>
        <input type="checkbox" [checked]="s.screenShake" (change)="patch({ screenShake: !s.screenShake })" />
        <span class="val">{{ s.screenShake ? 'ON' : 'OFF' }}</span>
      </label>

      <div class="row">
        <span>Technique cut-ins</span>
        <div class="seg">
          @for (opt of cutInOpts; track opt) {
            <button type="button" class="btn" [class.on]="s.cutIns === opt" (click)="patch({ cutIns: opt })">{{ opt }}</button>
          }
        </div>
      </div>

      <label class="row">
        <span>Mid-run eyecatch</span>
        <input type="checkbox" [checked]="s.eyecatch" (change)="patch({ eyecatch: !s.eyecatch })" />
        <span class="val">{{ s.eyecatch ? 'ON' : 'OFF' }}</span>
      </label>

      <div class="row">
        <span>UI scale</span>
        <div class="seg">
          @for (opt of scaleOpts; track opt) {
            <button type="button" class="btn" [class.on]="s.uiScale === opt" (click)="patch({ uiScale: opt })">{{ round(opt * 100) }}%</button>
          }
        </div>
      </div>

      <div class="row">
        <span>Autosave</span>
        <div class="seg">
          @for (opt of autosaveOpts; track opt) {
            <button type="button" class="btn" [class.on]="s.autosaveSec === opt" (click)="patch({ autosaveSec: opt })">{{ opt }}s</button>
          }
        </div>
      </div>

      <label class="row">
        <span>Confirm Fold Jumps</span>
        <input type="checkbox" [checked]="s.confirmJump" (change)="patch({ confirmJump: !s.confirmJump })" />
        <span class="val">{{ s.confirmJump ? 'ON' : 'OFF' }}</span>
      </label>

      <label class="row">
        <span>Flash tab on alerts</span>
        <input type="checkbox" [checked]="s.tabAlerts" (change)="patch({ tabAlerts: !s.tabAlerts })" />
        <span class="val">{{ s.tabAlerts ? 'ON' : 'OFF' }}</span>
      </label>

      <label class="row">
        <span>Browser notifications</span>
        <input type="checkbox" [checked]="s.notifications" (change)="toggleNotifications()" />
        <span class="val">{{ notifyLabel() }}</span>
      </label>

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

  protected readonly cutInOpts: Settings['cutIns'][] = ['full', 'short', 'off'];
  protected readonly scaleOpts = [0.9, 1, 1.1, 1.25];
  protected readonly autosaveOpts = [15, 30, 60, 120];
  private readonly permission = signal(typeof Notification !== 'undefined' ? Notification.permission : 'denied');

  protected readonly notifyLabel = computed(() => {
    if (typeof Notification === 'undefined') return 'N/A';
    if (this.permission() === 'denied') return 'BLOCKED';
    return this.settings.settings().notifications && this.permission() === 'granted' ? 'ON' : 'OFF';
  });

  /** Opt-in: turning notifications on asks the browser for permission. */
  protected async toggleNotifications(): Promise<void> {
    const on = !this.settings.settings().notifications;
    if (on && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      this.permission.set(await Notification.requestPermission());
    }
    this.patch({ notifications: on && this.permission() === 'granted' });
  }

  protected round(n: number): number {
    return Math.round(n);
  }

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
