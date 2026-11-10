import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatDuration, formatNumber } from '../game/format';
import { SaveError, fromExportString, toExportString } from '../game/save';
import { GameState } from '../game/types';
import { AudioService } from '../services/audio.service';
import { GameService } from '../services/game.service';
import { SettingsService } from '../services/settings.service';
import { readStorage, writeStorage } from '../services/storage';
import { SettingsPanel } from '../ui/settings-panel';
import { MusicToggle } from '../ui/music-toggle';
import { Starfield } from '../ui/starfield';

type Stage = 'boot' | 'press' | 'menu' | 'new' | 'saves' | 'settings' | 'credits';

const BOOT_KEY = 'fdm.booted';
const BOOT_LINES = [
  'MERIDIAN HEAVY INDUSTRIES // FOLD-CLASS COMMAND VESSEL',
  'BIOS v4.12 ............................. OK',
  'REACTOR CORE IGNITION .................. OK',
  'FOLD DRIVE ............................. STANDBY',
  'DRONE BAY .............................. EMPTY',
  'NAV COMPUTER "VESPER" .................. ONLINE',
  'PILOT LINK ESTABLISHED',
  '>> WELCOME, COMMANDER.',
];

@Component({
  selector: 'fdm-title-screen',
  imports: [FormsModule, SettingsPanel, Starfield, MusicToggle],
  templateUrl: './title-screen.html',
  styleUrl: './title-screen.scss',
  host: {
    '(document:keydown)': 'onKey($event)',
  },
})
export class TitleScreen implements OnInit {
  private readonly game = inject(GameService);
  protected readonly audio = inject(AudioService);
  protected readonly settings = inject(SettingsService);

  protected readonly stage = signal<Stage>('press');
  protected readonly bootShown = signal(0);
  protected readonly bootLines = BOOT_LINES;

  protected readonly save = signal<GameState | null>(null);
  protected readonly hasSave = computed(() => this.save() !== null);

  // New game form
  protected commander = 'Rook';
  protected ship = 'Halberd Dawn';
  protected readonly formError = signal('');

  // Import / export
  protected importText = '';
  protected readonly exportText = signal('');
  protected readonly ioMessage = signal('');
  protected readonly ioError = signal(false);

  private bootTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.bootTimer) clearTimeout(this.bootTimer);
    });
  }

  ngOnInit(): void {
    this.save.set(this.game.peekSave());
    if (!readStorage(BOOT_KEY)) {
      this.stage.set('boot');
      this.runBoot();
    }
  }

  // ------------------------------------------------------------ boot

  private runBoot(): void {
    const step = () => {
      if (this.bootShown() >= BOOT_LINES.length) {
        this.bootTimer = setTimeout(() => this.endBoot(), 900);
        return;
      }
      this.bootShown.update((n) => n + 1);
      this.bootTimer = setTimeout(step, this.settings.reducedMotion() ? 60 : 380);
    };
    this.bootTimer = setTimeout(step, 400);
  }

  protected endBoot(): void {
    if (this.stage() !== 'boot') return;
    if (this.bootTimer) clearTimeout(this.bootTimer);
    writeStorage(BOOT_KEY, '1');
    this.stage.set('press');
  }

  protected pressStart(): void {
    this.audio.unlock();
    this.audio.select();
    this.stage.set('menu');
  }

  protected onKey(e: KeyboardEvent): void {
    const st = this.stage();
    if (st === 'boot') {
      this.endBoot();
      e.preventDefault();
    } else if (st === 'press' && (e.key === 'Enter' || e.key === ' ')) {
      this.pressStart();
      e.preventDefault();
    } else if (e.key === 'Escape' && st !== 'menu' && st !== 'press') {
      this.go('menu');
    }
  }

  protected go(stage: Stage): void {
    this.audio.blip();
    this.ioMessage.set('');
    this.formError.set('');
    if (stage === 'saves') {
      this.exportText.set(this.save() ? toExportString(this.save()!) : '');
      this.importText = '';
    }
    this.stage.set(stage);
  }

  // ------------------------------------------------------------ menu actions

  protected continueGame(): void {
    this.audio.select();
    if (!this.game.continueGame()) {
      this.audio.denied();
      this.save.set(null);
    }
  }

  protected startNew(): void {
    const commander = this.commander.trim();
    const ship = this.ship.trim();
    if (!commander || !ship) {
      this.formError.set('Commander and ship both need a name.');
      this.audio.denied();
      return;
    }
    this.audio.select();
    this.game.newGame(commander.slice(0, 20), ship.slice(0, 24));
  }

  // ------------------------------------------------------------ import / export

  protected async copyExport(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.exportText());
      this.flash('Save code copied to clipboard.', false);
    } catch {
      this.flash('Could not copy — select the text and copy it manually.', true);
    }
  }

  protected downloadExport(): void {
    const blob = new Blob([this.exportText()], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fold-drive-miner-${new Date().toISOString().slice(0, 10)}.fdm.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.audio.blip();
  }

  protected async importFile(e: Event): Promise<void> {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.importText = (await file.text()).trim();
    this.doImport();
  }

  protected doImport(): void {
    try {
      const state = fromExportString(this.importText);
      this.audio.select();
      this.game.loadState(state);
    } catch (err) {
      this.flash(err instanceof SaveError ? err.message : 'Import failed.', true);
    }
  }

  private flash(msg: string, error: boolean): void {
    this.ioMessage.set(msg);
    this.ioError.set(error);
    if (error) this.audio.denied();
    else this.audio.blip();
  }

  // ------------------------------------------------------------ formatting

  protected fmt(n: number): string {
    return formatNumber(n, this.settings.settings().numberFormat);
  }

  protected duration(sec: number): string {
    return formatDuration(sec);
  }

  protected ago(ms: number): string {
    return formatDuration((Date.now() - ms) / 1000) + ' ago';
  }
}
