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
import { InventoryPanel } from './inventory-panel';
import { CommMessage, GameService, SPEAKER_NAMES, Tab } from '../services/game.service';
import { SettingsService } from '../services/settings.service';
import { MusicToggle } from '../ui/music-toggle';
import { SettingsPanel } from '../ui/settings-panel';
import { MusicService } from '../services/music.service';
import { AsteroidViewport } from './asteroid-viewport';
import { CrewPanel } from './crew-panel';
import { DefensePanel } from './defense-panel';
import { BoardPanel } from './board-panel';
import { FoldPanel } from './fold-panel';
import { ArchivePanel } from './archive-panel';
import { StoryScene } from '../ui/story-scene';
import { Eyecatch } from '../ui/eyecatch';
import * as ST from '../game/story-rules';
import { episodeDef } from '../game/story-data';
import { JumpOverlay } from '../ui/jump-overlay';
import * as F from '../game/fold-rules';
import { SortieModal } from './sortie-modal';
import { ThreatBanner } from './threat-banner';
import * as T from '../game/threat-rules';
import { HangarPanel } from './hangar-panel';
import { CutIn } from '../ui/cut-in';
import { PilotPortrait } from '../ui/pilot-portrait';
import { LabPanel } from './lab-panel';
import { MapPanel } from './map-panel';
import { OpsPanel } from './ops-panel';

interface NavItem {
  id: Tab;
  label: string;
  kana: string;
  icon: string;
  locked: boolean;
  hint: string;
}

@Component({
  selector: 'fdm-game-shell',
  imports: [
    InventoryPanel,
    AsteroidViewport,
    OpsPanel,
    LabPanel,
    MapPanel,
    HangarPanel,
    CrewPanel,
    DefensePanel,
    BoardPanel,
    FoldPanel,
    ArchivePanel,
    StoryScene,
    Eyecatch,
    JumpOverlay,
    ThreatBanner,
    SortieModal,
    SettingsPanel,
    MusicToggle,
    CutIn,
    PilotPortrait,
  ],
  templateUrl: './game-shell.html',
  styleUrl: './game-shell.scss',
  host: {
    '(document:keydown)': 'onKey($event)',
    // UI scale: zoom the game screen, then shrink its height to match so it still fits the window.
    '[style.zoom]': 'settings.settings().uiScale',
    '[style.--ui-scale]': 'settings.settings().uiScale',
  },
})
export class GameShell {
  protected readonly game = inject(GameService);
  protected readonly audio = inject(AudioService);
  protected readonly settings = inject(SettingsService);
  private readonly music = inject(MusicService);

  protected readonly s = computed(() => this.game.state()!);
  protected readonly menuOpen = signal(false);
  protected readonly lockedHint = signal<string | null>(null);

  private readonly labOpen = computed(() => {
    const s = this.s();
    return s.surveyData > 0 || s.stats.asteroidsCracked > 0 || Object.keys(s.research.levels).length > 0;
  });
  /** The Map opens with the Lab: it's where Survey Data charts new zones. */
  private readonly mapOpen = computed(
    () => this.labOpen() || E.unlockedZones(this.s()).length > 1 || this.s().anomalies.list.some((a) => a.status !== 'hidden'),
  );
  private readonly hangarOpen = computed(() => E.hasResearch(this.s(), 'hangar'));
  /** Defense opens once the quiet grace period ends (or anything has happened). */
  private readonly defenseOpen = computed(() => !T.inGrace(this.s()) || this.s().threats.log.length > 0 || this.s().threats.events.length > 0);
  protected readonly hostileWarning = computed(() => this.s().threats.events.some((e) => e.phase === 'warning'));
  protected readonly blackout = computed(() => T.marketBlocked(this.s()));
  /** Crew badge: someone has a trait to choose. */
  protected readonly crewReady = computed(() => this.s().pilots.some((p) => p.traitChoice));
  /** Board opens once contracts are offered or a convoy shows up. */
  private readonly boardOpen = computed(() => {
    const s = this.s();
    return s.contracts.board.length > 0 || s.contracts.active.length > 0 || !!s.trade.fleet || s.contracts.completed > 0;
  });
  private readonly foldOpen = computed(() => F.driveOnline(this.s()) || this.s().fold.jumps > 0);
  /** Fold badge: the drive is fully charged. */
  protected readonly foldReady = computed(() => F.driveOnline(this.s()) && this.s().fold.charge >= 1);
  /** Status-bar gauge: 10 segments of charge. */
  protected readonly foldGauge = computed(() => {
    const s = this.s();
    const online = F.driveOnline(s);
    const c = s.fold.charge;
    return { online, pct: Math.round(c * 100), segs: Array.from({ length: 10 }, (_, i) => c >= (i + 1) / 10 - 1e-9) };
  });
  /** An episode (or side story) waiting in the comm log. */
  protected readonly pendingStory = computed(() => {
    const s = this.s();
    const ep = ST.pendingEpisode(s);
    if (ep) return { side: false, label: `EPISODE ${String(ep).padStart(2, '0')}`, title: episodeDef(ep)!.title };
    const side = ST.pendingSide(s);
    if (side) return { side: true, label: `SIDE STORY ${String(side).padStart(2, '0')}`, title: ST.sideStory(side).title };
    return null;
  });
  /** Board badge: a merchant convoy is in the sector. */
  protected readonly boardReady = computed(() => !!this.s().trade.fleet);
  /** Map badge: an unscanned signal is waiting. */
  protected readonly mapReady = computed(() => this.s().anomalies.list.some((a) => a.status === 'signal' && a.kind !== 'golden_asteroid'));
  /** Lab badge: a bench is free and something can be started. */
  protected readonly labReady = computed(() => {
    const s = this.s();
    if (s.research.active.length >= E.labSlots(s)) return false;
    return E.RESEARCH.some((n) => E.researchBlocker(s, n.id) === null);
  });

  protected readonly nav = computed<NavItem[]>(() => [
    { id: 'ops', label: 'OPS', kana: 'さぎょう', icon: '◆', locked: false, hint: '' },
    { id: 'hangar', label: 'HANGAR', kana: 'かくのうこ', icon: '⬢', locked: !this.hangarOpen(), hint: 'Mech hangar sealed. Research Mech Hangar in the LAB.' },
    { id: 'crew', label: 'CREW', kana: 'クルー', icon: '☺', locked: !this.hangarOpen(), hint: 'No crew aboard yet. Research Mech Hangar in the LAB.' },
    { id: 'lab', label: 'LAB', kana: 'けんきゅう', icon: '⚗', locked: !this.labOpen(), hint: 'Research lab offline. Crack an asteroid to recover Survey Data.' },
    { id: 'map', label: 'MAP', kana: 'ちず', icon: '✦', locked: !this.mapOpen(), hint: 'No survey data yet. Crack an asteroid to start charting the sector.' },
    { id: 'defense', label: 'DEFENSE', kana: 'ぼうえい', icon: '⚔', locked: !this.defenseOpen(), hint: 'Sector is quiet. Defense command opens when trouble starts.' },
    { id: 'fold', label: 'FOLD', kana: 'フォールド', icon: '⟐', locked: !this.foldOpen(), hint: 'Fold Drive offline. Research it in the LAB (Fold Science).' },
    { id: 'archive', label: 'ARCHIVE', kana: 'きろく', icon: '❖', locked: false, hint: '' },
    { id: 'board', label: 'BOARD', kana: 'けいやく', icon: '▤', locked: !this.boardOpen(), hint: 'No contracts or traders yet. Earn a little first.' },
    { id: 'inventory', label: 'INVENTORY', kana: 'もちもの', icon: '▣', locked: false, hint: '' },
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
    if (r.alloys > 0) {
      any = true;
      lines.push(`+ ${this.game.fmt(r.alloys)} ALLOYS FORGED`);
    }
    if (r.credits > 0) lines.push(`+ ${this.game.fmt(r.credits)} CR FROM AUTO-SELL`);
    for (const t of r.threats.slice(0, 6)) lines.push(`▸ ${t.toUpperCase()}`);
    if (r.threats.length > 6) lines.push(`▸ …AND ${r.threats.length - 6} MORE INCIDENTS (SEE DEFENSE LOG)`);
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

  protected playStory(): void {
    const p = this.pendingStory();
    if (!p) return;
    if (p.side) this.game.playSide();
    else this.game.playEpisode();
  }

  protected speakerName(m: CommMessage): string {
    if (m.from === 'JACKAL') return '??? — UNKNOWN FRAME';
    if (m.from === 'TRADER') return m.name ?? 'TRADER';
    if (m.from === 'PILOT') return m.name ?? 'PILOT';
    return SPEAKER_NAMES[m.from] ?? m.from;
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

  /** The hotkey list (shown in the menu). */
  protected readonly hotkeys = [
    ['1–9, 0', 'Switch tabs (in nav order; 0 = Inventory)'],
    ['D', 'Drill the asteroid'],
    ['S', 'Sell all ore'],
    ['M', 'Music on / off'],
    ['Space / Enter', 'Advance a story scene'],
    ['Esc', 'Menu · close cards · skip scenes'],
  ];

  protected onKey(e: KeyboardEvent): void {
    // The story scene handles its own keys.
    if (this.game.scene()) return;
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
    const plain = !typing && !e.ctrlKey && !e.metaKey && !e.altKey;
    const overlay = this.menuOpen() || !!this.game.episode() || !!this.game.offlineReport() || !!this.game.sortie() || !!this.game.jump();
    if (plain && !overlay && /^[0-9]$/.test(e.key)) {
      // 1–9 are the first nine tabs; 0 is the tenth.
      const item = this.nav()[e.key === '0' ? 9 : Number(e.key) - 1];
      if (item) this.selectNav(item);
      return;
    }
    if (plain && !overlay && (e.key === 'd' || e.key === 'D') && !e.repeat) {
      this.game.drill();
      return;
    }
    if (plain && !overlay && (e.key === 's' || e.key === 'S')) {
      this.game.sellAll();
      return;
    }
    if ((e.key === 'm' || e.key === 'M') && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this.music.toggle();
      this.audio.blip();
      return;
    }
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
