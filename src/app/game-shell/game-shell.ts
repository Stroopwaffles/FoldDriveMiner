import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ORES } from '../game/config';
import { OfflineReport } from '../game/types';
import * as E from '../game/engine';
import { formatDuration } from '../game/format';
import { researchNode } from '../game/research';
import { AudioService } from '../services/audio.service';
import { GameService, Tab } from '../services/game.service';
import { SettingsService } from '../services/settings.service';
import { SettingsPanel } from '../ui/settings-panel';
import { AsteroidViewport } from './asteroid-viewport';
import { LabPanel } from './lab-panel';
import { MapPanel } from './map-panel';
import { OpsPanel } from './ops-panel';

interface NavItem {
  id: Tab | 'hangar' | 'crew' | 'board';
  label: string;
  kana: string;
  icon: string;
  locked: boolean;
  hint: string;
}

@Component({
  selector: 'fdm-game-shell',
  imports: [AsteroidViewport, OpsPanel, LabPanel, MapPanel, SettingsPanel],
  templateUrl: './game-shell.html',
  styleUrl: './game-shell.scss',
  host: {
    '(document:keydown)': 'onKey($event)',
  },
})
export class GameShell {
  protected readonly game = inject(GameService);
  protected readonly audio = inject(AudioService);
  protected readonly settings = inject(SettingsService);

  protected readonly s = computed(() => this.game.state()!);
  protected readonly menuOpen = signal(false);
  protected readonly lockedHint = signal<string | null>(null);

  private readonly labOpen = computed(() => {
    const s = this.s();
    return s.surveyData > 0 || s.stats.asteroidsCracked > 0 || Object.keys(s.research.levels).length > 0;
  });
  private readonly mapOpen = computed(() => E.unlockedZones(this.s()).length > 1);
  /** Lab badge: a bench is free and something can be started. */
  protected readonly labReady = computed(() => {
    const s = this.s();
    if (s.research.active.length >= E.labSlots(s)) return false;
    return E.RESEARCH.some((n) => E.researchBlocker(s, n.id) === null);
  });

  protected readonly nav = computed<NavItem[]>(() => [
    { id: 'ops', label: 'OPS', kana: 'さぎょう', icon: '◆', locked: false, hint: '' },
    { id: 'hangar', label: 'HANGAR', kana: 'かくのうこ', icon: '⬢', locked: true, hint: 'Mech hangar not yet installed.' },
    { id: 'crew', label: 'CREW', kana: 'クルー', icon: '☺', locked: true, hint: 'Crew quarters sealed. Pilots arrive later.' },
    { id: 'lab', label: 'LAB', kana: 'けんきゅう', icon: '⚗', locked: !this.labOpen(), hint: 'Research lab offline. Crack an asteroid to recover Survey Data.' },
    { id: 'map', label: 'MAP', kana: 'ちず', icon: '✦', locked: !this.mapOpen(), hint: 'No other zones charted. Research a survey in the LAB.' },
    { id: 'board', label: 'BOARD', kana: 'けいやく', icon: '▤', locked: true, hint: 'Contract board unavailable.' },
  ]);

  protected readonly ticker = computed(() => {
    const s = this.s();
    return ORES.map((o) => ({
      ore: o,
      // Same visibility as the cargo table: current tier plus the next one up.
      known: o.tier <= Math.max(s.drill.tier + 1, 2) && o.tier <= 4,
      price: E.orePrice(s, o.id),
      trend: E.priceTrend(s, o.id),
    }));
  });

  // ------------------------------------------------------------ comm log
  private readonly commBox = viewChild<ElementRef<HTMLElement>>('commBox');

  // ------------------------------------------------------------ offline report typing
  protected readonly reportLines = computed(() => {
    const r = this.game.offlineReport();
    if (!r) return [];
    // Untracked: only a new report should rebuild (and restart typing), not every game tick.
    return untracked(() => this.buildReport(r));
  });

  private buildReport(r: OfflineReport): string[] {
    const lines = [
      `TRANSMISSION LOG — COMMANDER ${this.s().commander.toUpperCase()}`,
      `TIME AWAY ........ ${formatDuration(r.seconds)}`,
    ];
    if (r.seconds > r.cappedSeconds) lines.push(`LOG CAPPED AT .... ${formatDuration(r.cappedSeconds)}`);
    lines.push(`DRONE OUTPUT ..... ${Math.round(r.efficiency * 100)}% (UNSUPERVISED)`);
    let any = false;
    for (const o of ORES) {
      if (r.gained[o.id] > 0.01) {
        any = true;
        lines.push(`+ ${this.game.fmt(r.gained[o.id])} ${o.name.toUpperCase()}`);
      }
    }
    for (const o of ORES) {
      if (r.ingots[o.id] > 0.01) {
        any = true;
        lines.push(`+ ${this.game.fmt(r.ingots[o.id])} ${o.name.toUpperCase()} INGOTS REFINED`);
      }
    }
    if (r.credits > 0) lines.push(`+ ${this.game.fmt(r.credits)} CR FROM AUTO-SELL`);
    for (const done of r.research) {
      const n = researchNode(done.id);
      lines.push(`RESEARCH COMPLETE: ${n.name.toUpperCase()}${n.maxLevel > 1 ? ` LV ${done.level}` : ''}${done.eureka ? ' — EUREKA!' : ''}`);
    }
    if (!any) lines.push('NO ORE COLLECTED. DEPLOY DRONES FOR IDLE INCOME.');
    if (r.cargoFull) lines.push(`⚠ CARGO HOLD FILLED — ${this.game.fmt(r.lost)} t OF ORE LOST`);
    return lines;
  }
  protected readonly reportShown = signal(0);

  constructor() {
    // Keep the comm log scrolled to the newest message.
    effect(() => {
      this.game.comms();
      const box = this.commBox()?.nativeElement;
      if (box) queueMicrotask(() => (box.scrollTop = box.scrollHeight));
    });

    // Type out the offline report line by line.
    let timer: ReturnType<typeof setInterval> | null = null;
    effect(() => {
      const lines = this.reportLines();
      if (timer) clearInterval(timer);
      this.reportShown.set(this.settings.reducedMotion() ? lines.length : 0);
      if (lines.length && !this.settings.reducedMotion()) {
        timer = setInterval(() => {
          this.reportShown.update((n) => n + 1);
          this.audio.blip();
          if (this.reportShown() >= lines.length && timer) clearInterval(timer);
        }, 220);
      }
    });

    // Auto-advance the episode card.
    let epTimer: ReturnType<typeof setTimeout> | null = null;
    effect(() => {
      if (this.game.episode()) {
        epTimer = setTimeout(() => this.closeEpisode(), 5200);
      }
    });

    inject(DestroyRef).onDestroy(() => {
      if (timer) clearInterval(timer);
      if (epTimer) clearTimeout(epTimer);
    });
  }

  protected selectNav(item: NavItem): void {
    if (item.locked) {
      this.audio.denied();
      this.lockedHint.set(item.hint);
      setTimeout(() => this.lockedHint.set(null), 2200);
    } else {
      this.audio.blip();
      this.game.tab.set(item.id as Tab);
    }
  }

  protected closeEpisode(): void {
    if (!this.game.episode()) return;
    this.audio.select();
    this.game.startEpisodeOne();
  }

  protected closeReport(): void {
    this.audio.select();
    this.game.offlineReport.set(null);
  }

  protected toggleMenu(): void {
    this.audio.blip();
    this.menuOpen.update((v) => !v);
  }

  protected saveNow(): void {
    this.game.save();
    this.audio.select();
  }

  protected toTitle(): void {
    this.audio.select();
    this.menuOpen.set(false);
    this.game.toTitle();
  }

  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.game.episode()) this.closeEpisode();
      else if (this.game.offlineReport()) this.closeReport();
      else this.toggleMenu();
    }
  }

  protected savedAgo(): string {
    const t = this.game.lastSaved();
    return t ? formatDuration((Date.now() - t) / 1000) : '—';
  }
}
