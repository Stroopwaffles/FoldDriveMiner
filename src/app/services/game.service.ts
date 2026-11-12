import { formatDuration } from '../game/format';
import { AlloyId } from '../game/alloy-data';
import { derelictDef, specialDef } from '../game/special-data';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { CONFIG, OreId, ZoneId, zoneDef } from '../game/config';
import * as E from '../game/engine';
import { formatNumber } from '../game/format';
import { researchNode } from '../game/research';
import { randomSeed } from '../game/rng';
import { ClickResult, GameState, MechJob, OfflineReport, PilotState, SortieReport, TickEvents } from '../game/types';
import * as T from '../game/threat-rules';
import * as A from '../game/anomaly-rules';
import * as F from '../game/fold-rules';
import { ARRIVAL } from '../game/fold-data';
import * as ST from '../game/story-rules';
import { ACTS, EPILOGUE, FINALE, FINAL_EPISODE, LAST_OFFER, MASTER_EPILOGUE, FinaleChoice, SceneSetting, StoryVoice, episodeDef, sceneSetting } from '../game/story-data';
import { BONUS_LABEL, medalDef } from '../game/medal-data';
import * as S from '../game/sector-rules';
import * as TR from '../game/trade-rules';
import { ClanId, clanDef } from '../game/trade-data';
import { Approach } from '../game/anomaly-data';
import { CORP_TAUNTS, CaptainId, JACKAL, RAIDER_TAUNTS, StandingOrders, captainDef, eventDef } from '../game/threat-data';
import { DroneType as DT } from '../game/fleet-data';
import { PostId, postDef } from '../game/crew-data';
import { DroneType, FrameId, SlotId, frameDef } from '../game/fleet-data';
import { AudioService } from './audio.service';
import { SaveService } from './save.service';
import { SettingsService } from './settings.service';

export type Tab = 'ops' | 'lab' | 'map' | 'hangar' | 'crew' | 'defense' | 'board' | 'fold' | 'archive' | 'inventory';

export type Speaker = StoryVoice | 'PILOT' | 'TRADER' | 'CORP' | 'PIRATE';

export const SPEAKER_NAMES: Partial<Record<Speaker, string>> = {
  JUNO: 'JUNO HART',
  KIT: 'KIT OKAFOR',
  SAFFI: 'SAFFI LIN',
  ANSEL: 'BROTHER ANSEL',
  HALE: 'DIRECTOR HALE',
  CORP: 'CORPORATE LIAISON',
};

export interface CommMessage {
  id: number;
  from: Speaker;
  /** Display name for generated pilots. */
  name?: string;
  /** Portrait seed for generated pilots. */
  seed?: number;
  /** Fixed portrait (a pirate captain). */
  look?: string;
  text: string;
  at: number;
}

/** The sortie screen: choosing a squad, or watching a battle play out. */
export interface SortieView {
  mode: 'prep' | 'play';
  /** The raid being defended (prep), a strike on the pirate base, or a convoy escort. */
  eventId?: number;
  strike?: boolean;
  escort?: boolean;
  /** Which convoy the escort is for (a Trade Nexus can host several). */
  escortClan?: ClanId;
  report?: SortieReport;
}

/** A Special Technique cut-in waiting to play full screen. */
export interface CutIn {
  pilot: string;
  callsign: string;
  story: string | null;
  seed: number;
  technique: string;
  color: string;
}

/** The Fold Jump cinematic, phase by phase. */
export interface JumpSequence {
  phase: 'arm' | 'farewell' | 'countdown' | 'tunnel' | 'flash';
  count: number;
  from: string;
  to: string;
  gained: number;
  /** A Deep Fold: back to depth 1, Resonance into Echoes. */
  deep: boolean;
}

export interface EpisodeCard {
  number: number;
  title: string;
  subtitle: string;
  /** Lines to say when the card closes (after a jump). */
  arrival?: [Speaker, string][];
  /** Replaces "EPISODE nn" (e.g. "FOLD JUMP 02"). */
  label?: string;
  /** "Next episode..." teaser line. */
  teaser?: string;
}

/** A story scene playing full screen: title card (index -1), dialogue, then the finale choice. */
export interface Scene {
  kind: 'episode' | 'side' | 'epilogue' | 'master_epilogue' | 'offer';
  n: number;
  label: string;
  title: string;
  act: string;
  lines: [Speaker, string][];
  index: number;
  replay: boolean;
  /** Ends on the permanent finale choice. */
  finale: boolean;
  /** The animated backdrop behind it. */
  setting: SceneSetting;
}

const SPEAKER_PITCH: Record<Speaker, number> = {
  VESPER: 420,
  JUNO: 760,
  KIT: 640,
  SAFFI: 690,
  ANSEL: 360,
  HALE: 400,
  SYSTEM: 300,
  PILOT: 560,
  JACKAL: 330,
  TRADER: 500,
  CORP: 380,
  PIRATE: 300,
};

/** Owns the live game state, the tick loop, saving and player actions. */
@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly saves = inject(SaveService);
  private readonly audio = inject(AudioService);
  private readonly settings = inject(SettingsService);

  private readonly _state = signal<GameState | null>(null);
  readonly state = this._state.asReadonly();

  readonly view = signal<'title' | 'game'>('title');
  readonly tab = signal<Tab>('ops');
  readonly offlineReport = signal<OfflineReport | null>(null);
  readonly episode = signal<EpisodeCard | null>(null);
  readonly comms = signal<CommMessage[]>([]);
  readonly lastSaved = signal<number | null>(null);
  readonly cutIn = signal<CutIn | null>(null);
  readonly jump = signal<JumpSequence | null>(null);
  readonly sortie = signal<SortieView | null>(null);
  readonly scene = signal<Scene | null>(null);
  /** The mid-run eyecatch card. */
  readonly eyecatch = signal(false);
  /** Which eyecatch look to show (0 ship, 1 mech, 2 VESPER), taken in turn. */
  readonly eyecatchVariant = signal(0);

  // Derived values used across the HUD.
  readonly power = computed(() => this.withState(E.drillPower, 0));
  readonly capacity = computed(() => this.withState(E.cargoCapacity, 0));
  readonly used = computed(() => this.withState(E.cargoUsed, 0));
  readonly cargoFull = computed(() => this.used() >= this.capacity() - 1e-6);
  /** Drone ore per second right now (0 while a flare or pirate harassment pins them down). */
  readonly droneRate = computed(() => this.withState((s) => E.droneRateTotal(s) * T.productionMult(s).drones, 0));
  readonly mechRate = computed(() => this.withState(E.mechRateTotal, 0));
  readonly overdrive = computed(() => this.withState(E.isOverdrive, false));

  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0;
  private sinceSave = 0;
  private commId = 0;

  constructor() {
    if (typeof document !== 'undefined') {
      // Only save on hide while playing; the title screen must not refresh lastSeen,
      // or time spent there would eat into offline progress.
      const saveIfPlaying = () => {
        if (this.view() === 'game') this.save();
      };
      const onHide = () => {
        if (document.visibilityState === 'hidden') saveIfPlaying();
      };
      document.addEventListener('visibilitychange', onHide);
      window.addEventListener('pagehide', saveIfPlaying);
      inject(DestroyRef).onDestroy(() => {
        document.removeEventListener('visibilitychange', onHide);
        this.stopLoop();
      });
    }
  }

  fmt(n: number): string {
    return formatNumber(n, this.settings.settings().numberFormat);
  }

  // ------------------------------------------------------------ lifecycle

  hasSave(): boolean {
    return this.saves.hasSave();
  }

  peekSave(): GameState | null {
    return this.saves.load();
  }

  newGame(commander: string, ship: string): void {
    const state = E.newGame(commander, ship, Date.now(), randomSeed());
    this.comms.set([]);
    this._state.set(state);
    this.save();
    this.episode.set({
      number: 1,
      title: 'Frontier Contract',
      subtitle: `The ${ship} arrives at the edge of charted space.`,
    });
    this.tab.set('ops');
    this.view.set('game');
    this.startLoop();
  }

  /** Loads the saved game and applies offline progress. */
  continueGame(): boolean {
    const state = this.saves.load();
    if (!state) return false;
    this.loadState(state);
    return true;
  }

  loadState(state: GameState): void {
    const away = (Date.now() - state.lastSeen) / 1000;
    let report: OfflineReport | null = null;
    if (away > CONFIG.offlineThresholdSec) report = E.simulateOffline(state, away);
    state.lastSeen = Date.now();
    this.comms.set([]);
    this._state.set(state);
    this.offlineReport.set(report);
    this.say('VESPER', `Systems restored. Welcome back, Commander ${state.commander}.`);
    this.save();
    this.tab.set('ops');
    this.view.set('game');
    this.startLoop();
  }

  toTitle(): void {
    this.save();
    this.stopLoop();
    this.view.set('title');
  }

  save(): void {
    const s = this._state();
    if (!s) return;
    s.lastSeen = Date.now();
    if (this.saves.save(s)) this.lastSaved.set(Date.now());
  }

  /** Called when the episode card closes: opening transmissions. */
  startEpisodeOne(): void {
    const ep = this.episode();
    this.episode.set(null);
    if (ep?.arrival) {
      ep.arrival.forEach(([who, line], i) => this.say(who, line, i * 1800));
      // An episode that arrived with the jump plays right after the card.
      const st = this._state();
      if (st && ST.pendingEpisode(st)) setTimeout(() => this.playEpisode(), 600);
      return;
    }
    const s = this._state();
    if (!s || s.flags['ep1Intro']) return;
    s.flags['ep1Intro'] = true;
    this.say('VESPER', `Fold-class command vessel ${s.ship} on station. Sector ${s.sector.code}, ${s.sector.name}.`);
    this.say('JUNO', `So this is the frontier? Just rocks. Lots and lots of rocks. Let's get drilling, Commander!`, 1800);
    this.say('VESPER', 'Click the asteroid to drill. Ore goes to the cargo hold. Sell it for credits.', 3600);
  }

  // ------------------------------------------------------------ loop

  private startLoop(): void {
    this.stopLoop();
    this.lastTick = Date.now();
    this.timer = setInterval(() => this.loop(), CONFIG.tickMs);
  }

  private stopLoop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private loop(): void {
    const s = this._state();
    if (!s) return;
    const now = Date.now();
    let dt = (now - this.lastTick) / 1000;
    this.lastTick = now;

    if (dt > CONFIG.offlineThresholdSec) {
      // The tab was asleep for a long time: treat it as offline.
      const report = E.simulateOffline(s, dt);
      this.offlineReport.set(report);
    } else {
      while (dt > 0) {
        const step = Math.min(dt, 1);
        this.handleEvents(E.tick(s, step));
        dt -= step;
      }
    }
    s.lastSeen = now;
    this.checkHints(s);
    this.publish();

    this.sinceSave += CONFIG.tickMs / 1000;
    this.checkEyecatch(s);
    if (this.sinceSave >= (this.settings.settings().autosaveSec || CONFIG.save.autosaveSec)) {
      this.sinceSave = 0;
      this.save();
    }
  }

  private publish(): void {
    const s = this._state();
    if (s) this._state.set({ ...s });
  }

  private withState<T>(fn: (s: GameState) => T, fallback: T): T {
    const s = this._state();
    return s ? fn(s) : fallback;
  }

  // ------------------------------------------------------------ actions

  drill(): ClickResult | null {
    const s = this._state();
    if (!s) return null;
    const wasOverdrive = E.isOverdrive(s);
    const r = E.click(s);
    if (r.locked) {
      this.audio.denied();
    } else if (r.overheated) {
      this.audio.overheat();
      if (!s.flags['firstOverheat']) {
        s.flags['firstOverheat'] = true;
        this.say('VESPER', 'Drill overheated. Venting — lockout three seconds. Click in a steady rhythm to keep the drill cool and in Overdrive.');
      }
    } else {
      this.audio.drill(r.overdrive);
      if (r.overdrive && !wasOverdrive) this.audio.overdrive();
      if (r.cracked) this.audio.crack();
      if (r.dataCore) {
        this.audio.dataCore();
        this.say('VESPER', 'Data Core recovered from the asteroid core. Rare find, Commander.');
      }
      if (r.overdrive && !s.flags['firstOverdrive']) {
        s.flags['firstOverdrive'] = true;
        this.say('JUNO', "OVERDRIVE! A cool drill bites deeper — keep a steady rhythm and don't let it run hot!");
      }
      if (r.special) {
        this.audio.dataCore();
        this.say('VESPER', `${r.special.name} cracked open: ${r.special.salvage || 'rich ore'}.`);
      }
      if (r.cracked) this.announceSpecial();
    }
    this.publish();
    return r;
  }

  /** A special rock just drifted in: VESPER calls it out. */
  private announceSpecial(): void {
    const s = this._state();
    const sp = s?.asteroid.special;
    if (!s || !sp) return;
    const name = E.specialName(sp);
    if (sp.kind === 'derelict') {
      const d = derelictDef(sp.derelict!);
      this.say('VESPER', `Sensor contact: a ${d.name}, dead in space. Cut through the hull and we salvage ${d.salvage}.`);
    } else {
      this.say('VESPER', `Sensor contact: ${name}. ${specialDef(sp.kind).desc}`);
    }
    if (!s.flags['firstSpecial']) {
      s.flags['firstSpecial'] = true;
      this.say('JUNO', "Ooh, something different! These don't show up often. Better sensors would find more of them.", 2500);
    }
  }

  /** Starts a sector scan to chart the next zone (Survey Data). */
  startScan(): void {
    this.act(S.startScan, () => {
      this.audio.select();
      const s = this._state()!;
      const sec = s.sector.scan?.duration ?? 0;
      this.say('VESPER', `Sector scan underway. Sweeping the outer field — about ${formatDuration(sec)}.`);
    });
  }

  cancelScan(): void {
    this.act(S.cancelScan, () => this.audio.blip());
  }

  buySensorArray(): void {
    this.act(E.buySensorArray, () => this.audio.buy());
  }

  /** Hyperthought Engine on/off and its Survey Data reserve. */
  setBooster(on: boolean): void {
    this.act((s) => E.setBooster(s, on), () => this.audio.blip());
  }

  cycleBoosterReserve(): void {
    this.act((s) => (E.cycleReserve(s), true), () => this.audio.blip());
  }

  sell(ore: OreId): void {
    this.act((s) => E.sell(s, ore) > 0, () => this.audio.sell());
  }

  sellAll(): void {
    this.act((s) => E.sellAll(s) > 0, () => this.audio.sell());
  }

  buyDrones(count: number): void {
    this.act(
      (s) => E.buyDrones(s, count) > 0,
      () => {
        this.audio.buy();
        const s = this._state()!;
        if (!s.flags['firstDrone']) {
          s.flags['firstDrone'] = true;
          this.say('VESPER', 'Prospector drone deployed. Drones mine the sector field continuously — even while you are away.');
        }
      },
    );
  }

  buyDrillPower(): void {
    this.act(E.buyDrillPower, () => this.audio.buy());
  }

  buyDrillTier(): void {
    this.act(E.buyDrillTier, () => {
      this.audio.buy();
      this.say('JUNO', "Mk.II drill head installed! That blue glint in the rocks? Titanite. It's ours now.");
    });
  }

  buyHeatSink(): void {
    this.act(E.buyHeatSink, () => this.audio.buy());
  }

  buyCargo(): void {
    this.act(E.buyCargo, () => this.audio.buy());
  }

  buyClamp(): void {
    this.act(E.buyClamp, () => {
      this.audio.buy();
      this.say('JUNO', 'Trigger Clamp fitted! Just hold the button down on the rock and the drill keeps biting.');
    });
  }

  sellIngots(ore: OreId): void {
    this.act((s) => E.sellIngots(s, ore) > 0, () => this.audio.sell());
  }

  sellAlloy(id: AlloyId): void {
    this.act((s) => E.sellAlloy(s, id) > 0, () => this.audio.sell());
  }

  toggleAutoSellAlloy(id: AlloyId): void {
    this.act((s) => E.toggleAutoSellAlloy(s, id), () => this.audio.blip());
  }

  startForge(id: AlloyId): void {
    this.act((s) => E.startForge(s, id), () => this.audio.buy());
  }

  setForgeRepeat(repeat: boolean): void {
    this.act((s) => E.setForgeRepeat(s, repeat), () => this.audio.blip());
  }

  clearForge(): void {
    this.act(E.clearForge, () => this.audio.blip());
  }

  toggleAutoSell(kind: 'ore' | 'ingot', ore: OreId): void {
    this.act((s) => E.toggleAutoSell(s, kind, ore), () => this.audio.blip());
  }

  toggleSmartSell(): void {
    this.act(E.toggleSmartSell, () => this.audio.blip());
  }

  // ------------------------------------------------------------ zones

  setZone(id: ZoneId): void {
    this.act(
      (s) => E.setZone(s, id),
      () => {
        this.audio.select();
        const z = zoneDef(id);
        this.say('VESPER', `Course set: ${z.name}. ${z.desc}`);
        this.announceSpecial();
      },
    );
  }

  // ------------------------------------------------------------ research

  startResearch(id: string): void {
    this.act(
      (s) => E.startResearch(s, id),
      () => {
        this.audio.select();
        if (!this._state()!.flags['firstResearch']) {
          this._state()!.flags['firstResearch'] = true;
          this.say('VESPER', 'Research underway. Projects continue while you are away — the lab never sleeps. Neither do I.');
        }
      },
    );
  }

  cancelResearch(index: number): void {
    this.act((s) => E.cancelResearch(s, index), () => this.audio.blip());
  }

  /** Spends Data Cores to finish a research project on the next tick. */
  rushResearch(index: number): void {
    this.act((s) => E.rushResearch(s, index), () => this.audio.dataCore());
  }

  buyMatrix(id: string): void {
    this.act(
      (s) => E.buyMatrix(s, id),
      () => {
        this.audio.buy();
        if (!this._state()!.flags['firstMatrix']) {
          this._state()!.flags['firstMatrix'] = true;
          this.say('VESPER', 'Core Matrix online. What we build into it stays with the ship, through every fold.');
        }
      },
    );
  }

  // ------------------------------------------------------------ refinery

  startBatch(index: number, ore: OreId): void {
    this.act((s) => E.startBatch(s, index, ore), () => this.audio.buy());
  }

  buyFurnaceCapacity(): void {
    this.act(E.buyFurnaceCapacity, () => this.audio.buy());
  }

  setSlotRepeat(index: number, repeat: boolean): void {
    this.act(
      (s) => {
        if (!E.setSlotRepeat(s, index, repeat)) return false;
        // Turning repeat on for an idle, assigned slot starts it right away.
        const slot = s.refinery.slots[index];
        if (repeat && slot.ore && slot.batch === 0) E.startBatch(s, index, slot.ore);
        return true;
      },
      () => this.audio.blip(),
    );
  }

  clearSlot(index: number): void {
    this.act((s) => E.clearSlot(s, index), () => this.audio.blip());
  }

  private handleEvents(ev: TickEvents): void {
    const s = this._state()!;
    for (const t of ev.threatStarted) this.announceThreat(t);
    if (ev.story.length) this.storySay(ev.story);
    for (const t of ev.trade) this.tradeSay(t);
    for (const a of ev.anomaly) {
      this.say('VESPER', a.text);
      if (a.lore) this.audio.dataCore();
      else if (a.good) this.audio.blip();
      if (a.kind === 'golden_asteroid' && a.text.startsWith('A golden')) this.audio.select();
      if (a.lore === 1) this.say('JUNO', "A message older than the shipping lanes... and it's talking to US? I don't like this, Commander.", 2500);
      if (a.lore === 3) this.say('VESPER', "Commander. The beacon is transmitting this ship's name. In my own voice.", 2500);
    }
    for (const r of ev.threatResolved) {
      this.say('VESPER', r.text);
      if (r.sortie) this.afterSortie(r.sortie, false);
    }
    for (const up of ev.levelUps) {
      const p = s.pilots.find((x) => x.id === up.pilotId);
      // Only announce every fifth level so the comm log doesn't fill with level-ups.
      if (!p || up.level % 5 !== 0) continue;
      this.pilotSay(p, up.level % 10 === 0 && p.traitChoice ? `Level ${up.level}! I've learned something new — check my dossier, Commander.` : `Level ${up.level}. Getting the hang of this.`);
    }
    for (const sy of ev.syncUps) {
      const p = s.pilots.find((x) => x.id === sy.pilotId);
      if (!p) continue;
      const frame = frameDef(sy.frame).name;
      this.pilotSay(p, sy.level >= 5 ? `Full sync with the ${frame}! I've got a Special Technique ready — just say the word!` : `Sync ${sy.level} with the ${frame}. It's starting to feel like part of me.`);
    }
    for (const id of ev.autoRepairs) {
      const m = s.mechs.find((x) => x.id === id);
      if (m) this.say('VESPER', `${m.designation} "${m.name}" returning to the repair bay for maintenance.`);
    }
    if (ev.rebuilt?.length) {
      this.audio.select();
      this.say('VESPER', `Loadout Memory rebuilt ${ev.rebuilt.join(' and ')} in the hangar.`);
    }
    if (ev.assistantStarted?.length) {
      this.say('VESPER', `ARIA put ${ev.assistantStarted.join(' and ')} on a free lab bench.`);
    }
    for (const id of ev.repairStalled ?? []) {
      const m = s.mechs.find((x) => x.id === id);
      if (m) this.say('VESPER', `Repairs on ${m.designation} have stopped: the bay needs credits and Ferrite or Titanite in the hold.`);
    }
    for (const name of ev.charted) {
      this.audio.dataCore();
      this.say('VESPER', `Sector scan complete: ${name} charted. Open the MAP to set course.`);
    }
    for (const r of ev.research) {
      const node = researchNode(r.id);
      const lvl = node.maxLevel > 1 ? ` (level ${r.level})` : '';
      this.audio.dataCore();
      this.say('VESPER', `Research complete: ${node.name}${lvl}. ${node.effect}.`);
      if (r.eureka) this.say('VESPER', 'EUREKA! A breakthrough — the project cost has been fully refunded.', 900);
      this.researchAnnouncements(r.id);
    }
  }

  private researchAnnouncements(id: string): void {
    switch (id) {
      case 'refinery':
        this.say('JUNO', 'A refinery! Ten rocks in, one shiny bar out. Check the OPS panel, Commander.', 1500);
        break;
      case 'drill_mk3':
        this.say('JUNO', "Mk.III is in! That purple stuff is Iridium — and it's worth a fortune.", 1500);
        break;
      case 'auto_sell':
        this.say('VESPER', 'Auto-Sell online. Toggle AUTO on any cargo row.', 1500);
        break;
      case 'auto_refine':
        this.say('VESPER', 'Auto-Refine online. Set a slot to REPEAT and it will keep itself fed.', 1500);
        break;
      case 'hangar':
        this.say('JUNO', "Juno Hart, reporting for duty! Build me a mech and I'll show you real mining, Commander.", 1500);
        this.say('VESPER', 'HANGAR and CREW systems are online.', 3000);
        break;
      case 'loadout_memory':
        this.say('VESPER', 'Loadout Memory online. Save a mech in the HANGAR and rebuild it after any Fold Jump.', 1500);
        break;
      case 'repair_bay':
        this.say('KIT', "Kit Okafor, engineer! I brought a few tools. Okay, a lot of tools. Your mechs are in good hands.", 1500);
        break;
      case 'fleet_dispatch':
        this.say('VESPER', 'Fleet Dispatch online. Split mining drones across zones on the MAP.', 1500);
        break;
      case 'drill_mk4':
        this.say('JUNO', 'Mk.IV online! Helium-3, here we come. Fuel of the future, right?', 1500);
        break;
    }
  }

  private act(fn: (s: GameState) => boolean, onSuccess: () => void): void {
    const s = this._state();
    if (!s) return;
    if (fn(s)) onSuccess();
    else this.audio.denied();
    this.publish();
  }

  // ------------------------------------------------------------ fleet

  buyDronesOf(type: DroneType, count: number): void {
    this.act((s) => E.buyDronesOf(s, type, count) > 0, () => this.audio.buy());
  }

  setDispatch(zone: ZoneId, weight: number): void {
    const s = this._state();
    if (!s) return;
    E.setDispatch(s, zone, weight);
    this.publish();
  }

  buildMech(frame: FrameId): void {
    this.act(
      (s) => E.buildMech(s, frame) !== null,
      () => {
        this.audio.select();
        const s = this._state()!;
        const m = s.mechs[s.mechs.length - 1];
        this.say('VESPER', `${m.designation} "${m.name}" (${frameDef(frame).name} frame) assembled in bay ${s.mechs.length}. Fit parts, seat a pilot, then set it to MINE.`);
        if (!s.flags['firstMech']) {
          s.flags['firstMech'] = true;
          this.say('JUNO', "Oh, she's beautiful. Put me in, Commander! And maybe give her a drill first.", 2500);
        }
      },
    );
  }

  scrapMech(id: number): void {
    this.act((s) => E.scrapMech(s, id), () => this.audio.blip());
  }

  setMechJob(id: number, job: MechJob): void {
    this.act(
      (s) => E.setMechJob(s, id, job),
      () => {
        this.audio.blip();
        const s = this._state()!;
        const m = s.mechs.find((x) => x.id === id)!;
        if (job === 'mining') {
          const p = E.mechPilot(s, m);
          this.say(p?.story === 'juno' ? 'JUNO' : p?.story === 'kit' ? 'KIT' : p ? 'PILOT' : 'VESPER',
            p ? `${m.designation}, launching! Heading for the ${zoneDef(m.zone).name}.` : `${m.designation} launching on autopilot.`,
            0, p ?? undefined);
        }
      },
    );
  }

  setMechZone(id: number, zone: ZoneId): void {
    this.act((s) => E.setMechZone(s, id, zone), () => this.audio.blip());
  }

  seatPilot(mechId: number, pilotId: number | null): void {
    this.act((s) => E.seatPilot(s, mechId, pilotId), () => this.audio.blip());
  }

  buyPart(partId: string): void {
    this.act((s) => E.buyPart(s, partId), () => this.audio.buy());
  }

  // ------------------------------------------------------------ saved loadouts

  saveLoadout(mechId: number, crew: boolean): void {
    this.act(
      (s) => E.saveLoadout(s, mechId, crew) !== null,
      () => {
        this.audio.blip();
        const l = E.mechLoadout(this._state()!, mechId);
        if (l) this.say('VESPER', `Loadout "${l.name}" saved to the core. It will survive a Fold Jump.`);
      },
    );
  }

  renameLoadout(id: number, name: string): void {
    this.act((s) => E.renameLoadout(s, id, name), () => this.audio.blip());
  }

  deleteLoadout(id: number): void {
    this.act((s) => E.deleteLoadout(s, id), () => this.audio.blip());
  }

  setAutoRebuild(on: boolean): void {
    this.act((s) => E.setAutoRebuild(s, on), () => this.audio.blip());
  }

  /** Rebuild one loadout, or all of them with id null. Reports what was skipped. */
  rebuildLoadout(id: number | null): void {
    const s = this._state();
    if (!s) return;
    const r = id === null ? E.rebuildAll(s) : E.rebuildLoadout(s, id);
    const did = r.built.length + r.fitted;
    if (did) this.audio.buy();
    else this.audio.denied();
    const parts = [
      r.built.length ? `built ${r.built.join(', ')}` : '',
      r.fitted ? `fitted ${r.fitted} part${r.fitted === 1 ? '' : 's'} (${r.bought} bought)` : '',
      r.spent > 0 ? `spent ${this.fmt(r.spent)} cr` : '',
    ].filter(Boolean);
    if (parts.length) this.say('VESPER', `Rebuild: ${parts.join(', ')}.`);
    else if (!r.issues.length) this.say('VESPER', 'Nothing to rebuild: every saved loadout is already in the hangar.');
    if (r.issues.length) {
      const shown = r.issues.slice(0, 4).join(' · ');
      const more = r.issues.length > 4 ? ` (+${r.issues.length - 4} more)` : '';
      this.say('VESPER', `Couldn't finish: ${shown}${more}.`, parts.length ? 600 : 0);
    }
    this.publish();
  }

  equipPart(mechId: number, slot: SlotId, partId: string | null): void {
    this.act((s) => E.equipPart(s, mechId, slot, partId), () => this.audio.blip());
  }

  useTechnique(mechId: number): void {
    const s = this._state();
    if (!s) return;
    const m = s.mechs.find((x) => x.id === mechId);
    if (!m || !E.useTechnique(s, mechId)) {
      this.audio.denied();
      return;
    }
    const p = E.mechPilot(s, m)!;
    const name = E.techniqueName(s, m);
    this.showCutIn({
      pilot: p.name,
      callsign: p.callsign,
      story: p.story,
      seed: p.portraitSeed,
      technique: name,
      color: frameDef(m.frame).color,
    });
    this.audio.overdrive();
    this.publish();
  }

  // ------------------------------------------------------------ crew

  hirePilot(index: number): void {
    this.act(
      (s) => E.hirePilot(s, index),
      () => {
        this.audio.select();
        const s = this._state()!;
        this.pilotSay(s.pilots[s.pilots.length - 1], 'Reporting aboard, Commander. Where do you need me?');
      },
    );
  }

  rerollRecruits(): void {
    this.act(E.rerollRecruits, () => this.audio.blip());
  }

  dismissPilot(id: number): void {
    const s = this._state();
    const p = s?.pilots.find((x) => x.id === id);
    this.act(
      (st) => E.dismissPilot(st, id),
      () => {
        this.audio.blip();
        if (p) this.pilotSay(p, 'Understood. It was an honour flying with you, Commander.');
      },
    );
  }

  assignPost(post: PostId, pilotId: number | null): void {
    this.act(
      (s) => E.assignPost(s, post, pilotId),
      () => {
        this.audio.blip();
        const s = this._state()!;
        const p = s.pilots.find((x) => x.id === pilotId);
        if (p) this.pilotSay(p, `Taking over as ${postDef(post).name}.`);
      },
    );
  }

  chooseTrait(pilotId: number, trait: string): void {
    this.act((s) => E.chooseTrait(s, pilotId, trait), () => this.audio.select());
  }

  /** A line from a pilot, using the story speakers where possible. */
  pilotSay(p: PilotState, text: string): void {
    const from: Speaker = p.story === 'juno' ? 'JUNO' : p.story === 'kit' ? 'KIT' : 'PILOT';
    this.say(from, text, 0, p);
  }

  // ------------------------------------------------------------ threats

  private announceThreat(e: { id: number; kind: string; jackal?: boolean; captain?: CaptainId; corporate?: boolean; ore?: OreId; phase: string }): void {
    const def = eventDef(e.kind as never);
    if (def.hostile) this.audio.klaxon();
    switch (e.kind) {
      case 'raid':
        if (e.corporate) {
          this.say('VESPER', `WARNING: Meridian Security wing on approach. Raid in ${def.warning} seconds. They hit harder than pirates.`);
          this.say('HALE', 'Nothing personal, Commander. You broke something that belonged to us.', 1200);
          this.alert('Meridian Security raid incoming!');
          break;
        }
        this.say('VESPER', `WARNING: pirate signal on approach. Raid in ${def.warning} seconds. Ready a sortie or check your standing orders.`);
        this.alert('Pirate raid incoming!');
        if (e.jackal) {
          const s = this._state()!;
          if (s.threats.jackalEncounters === 0) {
            // Her entrance: the first raid after the first Fold Jump.
            JACKAL.intro.forEach(([who, line, delay], i) =>
              this.say(who as Speaker, line, delay, undefined, who === 'JACKAL' ? (i === 0 ? '??? — UNKNOWN FRAME' : this.jackalName(s)) : undefined),
            );
          } else {
            const lines = JACKAL.lines[T.jackalMood(s)].arrive;
            this.say('JACKAL', lines[s.threats.jackalEncounters % lines.length], 1200, undefined, this.jackalName(s));
          }
        } else if (e.captain) {
          const s = this._state()!;
          const c = captainDef(e.captain);
          const met = s.threats.captains?.[e.captain] ?? 0;
          const underJackal = s.threats.jackalEncounters > 0 && s.fold.jumps >= 1;
          this.sayPirate(e.captain, underJackal ? c.underJackal : c.arrive[met % c.arrive.length], 1200);
          if (met === 0 && !underJackal) this.say('JUNO', `${c.name}? VESPER, pull everything we've got on that ship.`, 4200);
        }
        break;
      case 'flare':
        this.say('VESPER', `WARNING: solar flare in ${def.warning} seconds. Shelter the drones or ride it out.`);
        break;
      case 'rogue':
        this.say('VESPER', `WARNING: rogue asteroid on collision course! Impact in ${def.warning} seconds. Crack it with the drill — or let a mech intercept.`);
        this.alert('Rogue asteroid on collision course!');
        break;
      case 'micrometeor':
        this.say('VESPER', 'Micrometeor storm! Drones are taking hits. Guardians will shield the swarm.');
        break;
      case 'reactor':
        this.say('KIT', 'Reactor fault! Everything\'s running at 70% until I — or the Repair Chief — get it patched.');
        break;
      case 'blackout':
        this.say('VESPER', 'Comms blackout. The exchange is unreachable — no selling until the signal returns.');
        break;
      case 'boom':
        this.say('VESPER', `Market boom: ${e.ore ? T.oreName(e.ore) : 'ore'} is selling at double price for five minutes!`);
        break;
      case 'crash':
        this.say('VESPER', `Market crash: ${e.ore ? T.oreName(e.ore) : 'ore'} prices have halved. Hold or refine it for now.`);
        break;
    }
  }

  /** After any sortie: comms, sounds, and the replay screen if the player is here. */
  private afterSortie(report: SortieReport, manual: boolean): void {
    const s = this._state()!;
    if (report.outcome === 'victory' || report.outcome === 'costly') this.audio.victory();
    else this.audio.defeat();
    const pirateWon = report.outcome === 'defeat' || report.outcome === 'surrender';
    if (report.jackal) {
      if (s.threats.jackalEncounters === 1 && !report.strike) {
        this.say('JACKAL', pirateWon ? JACKAL.introWin : JACKAL.introLose, 1500, undefined, this.jackalName(s));
      } else {
        const set = JACKAL.lines[T.jackalMood(s)];
        const lines = pirateWon ? set.win : set.lose;
        this.say('JACKAL', lines[s.threats.jackalEncounters % lines.length], 1500, undefined, this.jackalName(s));
      }
    } else if (report.captain) {
      const c = captainDef(report.captain);
      const lines = pirateWon ? c.win : c.lose;
      this.sayPirate(report.captain, lines[(s.threats.captains?.[report.captain] ?? 0) % lines.length], 1500);
    } else if (pirateWon) {
      // Ordinary raiders (and Meridian's security wings) always rub it in.
      const n = s.threats.raidsLost + s.threats.raids;
      if (report.enemy === 'Meridian Security') {
        this.say('CORP', CORP_TAUNTS[n % CORP_TAUNTS.length], 1500, undefined, 'MERIDIAN SECURITY');
      } else {
        const lines = report.outcome === 'surrender' ? RAIDER_TAUNTS.surrender : RAIDER_TAUNTS.defeat;
        this.say('PIRATE', lines[n % lines.length], 1500, undefined, 'PIRATE RAIDER', 'raider');
      }
    }
    if (s.threats.baseFound && !s.flags['baseFound']) {
      s.flags['baseFound'] = true;
      this.say('VESPER', 'Pirate transmissions traced to a hidden base. A strike is possible from the DEFENSE screen.', 3000);
    }
    if (report.outcome !== 'surrender' && (manual || this.view() === 'game')) {
      this.sortie.set({ mode: 'play', report });
    }
  }

  respond(eventId: number, response: string): void {
    this.act((s) => T.respondToEvent(s, eventId, response), () => this.audio.select());
  }

  setOrder<K extends keyof StandingOrders>(key: K, value: StandingOrders[K]): void {
    const s = this._state();
    if (!s) return;
    T.setStandingOrder(s, key, value);
    this.audio.blip();
    this.publish();
  }

  openSortiePrep(eventId?: number, strike = false, escort: ClanId | boolean = false): void {
    this.audio.select();
    this.sortie.set({ mode: 'prep', eventId, strike, escort: !!escort, ...(typeof escort === 'string' ? { escortClan: escort } : {}) });
  }

  closeSortie(): void {
    this.sortie.set(null);
  }

  launchSortie(mechIds: number[], useGuardians: boolean): void {
    const s = this._state();
    const view = this.sortie();
    if (!s || !view) return;
    const events = this.blankEvents();
    const report = view.escort
      ? T.launchEscort(s, mechIds, useGuardians, events, view.escortClan)
      : view.strike
        ? T.launchStrike(s, mechIds, useGuardians, events)
        : T.launchDefense(s, view.eventId ?? -1, mechIds, useGuardians, events);
    if (!report) {
      this.audio.denied();
      return;
    }
    this.audio.explosion();
    for (const r of events.threatResolved) this.say('VESPER', r.text);
    for (const t of events.trade) this.tradeSay(t);
    this.afterSortie(report, true);
    this.publish();
  }

  surrender(eventId: number): void {
    const s = this._state();
    if (!s) return;
    const events = this.blankEvents();
    if (T.surrenderRaid(s, eventId, events)) {
      this.sortie.set(null);
      for (const r of events.threatResolved) {
        this.say('VESPER', r.text);
        // Taunts (Jackal, captains, raiders) and the defeat sting, as for any other lost fight.
        if (r.sortie) this.afterSortie(r.sortie, false);
      }
    }
    this.publish();
  }

  rogueClick(): T.RogueClick | null {
    const s = this._state();
    if (!s) return null;
    const events = this.blankEvents();
    const r = T.rogueClick(s, events);
    if (r) {
      if (r.locked) this.audio.denied();
      else if (r.overheated) this.audio.overheat();
      else this.audio.drill(r.overdrive);
      if (r.cracked) {
        this.audio.crack();
        this.audio.victory();
      }
      for (const x of events.threatResolved) this.say('VESPER', x.text);
    }
    this.publish();
    return r;
  }

  // ------------------------------------------------------------ anomalies

  scanAnomaly(id: number): void {
    this.act((s) => A.startScan(s, id), () => this.audio.select());
  }

  launchMission(id: number, approach: Approach, mechId?: number): void {
    this.act(
      (s) => A.launchMission(s, id, approach, mechId),
      () => {
        this.audio.select();
        const s = this._state()!;
        const m = s.mechs.find((x) => x.id === mechId);
        const p = m ? E.mechPilot(s, m) : null;
        if (p) this.pilotSay(p, 'Heading out to take a look. Keep the comms open, Commander.');
      },
    );
  }

  startDecode(id: number): void {
    this.act((s) => A.startDecode(s, id), () => this.audio.select());
  }

  deployRig(id: number): void {
    this.act((s) => A.deployRig(s, id), () => this.audio.buy());
  }

  /** ARIA, the research assistant. */
  setAssistant(on: boolean): void {
    this.act((s) => E.setAssistant(s, on), () => this.audio.blip());
  }

  setAssistantMode(mode: E.AssistantMode): void {
    this.act((s) => E.setAssistantMode(s, mode), () => this.audio.blip());
  }

  enqueueResearch(id: string): void {
    this.act((s) => E.enqueue(s, id), () => this.audio.blip());
  }

  dequeueResearch(index: number): void {
    this.act((s) => E.dequeue(s, index), () => this.audio.blip());
  }

  clearResearchQueue(): void {
    this.act(E.clearQueue, () => this.audio.blip());
  }

  upgradeRig(id: number): void {
    this.act((s) => A.upgradeRig(s, id), () => this.audio.buy());
  }

  goldenClick(): A.GoldenClick | null {
    const s = this._state();
    if (!s) return null;
    const events = this.blankEvents();
    const r = A.goldenClick(s, events);
    if (r) {
      if (r.locked) this.audio.denied();
      else if (r.overheated) this.audio.overheat();
      else this.audio.drill(true);
      if (r.cracked) {
        this.audio.crack();
        this.audio.victory();
      }
      for (const a of events.anomaly) this.say('VESPER', a.text);
    }
    this.publish();
    return r;
  }

  // ------------------------------------------------------------ trade & contracts

  /** Merchant captains and corporate liaisons speak in the comm log. */
  private tradeSay(t: { text: string; good: boolean; from?: string; clan?: ClanId }): void {
    const s = this._state()!;
    const id = t.clan ?? s.trade.fleets[0]?.clan;
    if (t.from === 'merchant' && id) {
      const clan = clanDef(id);
      this.say('TRADER', t.text, 0, undefined, clan.captain);
    } else if (t.from === 'corp') {
      this.say('CORP', t.text);
    } else {
      this.say('VESPER', t.text);
    }
  }

  buyItem(itemId: number, pay: TR.PayMethod): void {
    const s = this._state();
    if (!s) return;
    const events = this.blankEvents();
    if (TR.buyItem(s, itemId, pay, events)) this.audio.buy();
    else this.audio.denied();
    for (const t of events.trade) this.tradeSay(t);
    for (const t of events.threatStarted) this.announceThreat(t);
    this.publish();
  }

  deliverFavor(clan?: ClanId): void {
    const s = this._state();
    if (!s) return;
    const events = this.blankEvents();
    if (TR.deliverFavor(s, events, clan)) this.audio.sell();
    else this.audio.denied();
    for (const t of events.trade) this.tradeSay(t);
    this.publish();
  }

  useRepairKit(mechId: number): void {
    this.act((s) => TR.useRepairKit(s, mechId), () => this.audio.buy());
  }

  useMedkit(pilotId: number): void {
    this.act((s) => TR.useMedkit(s, pilotId), () => this.audio.buy());
  }

  acceptContract(id: number): void {
    this.act((s) => TR.acceptContract(s, id), () => this.audio.select());
  }

  abandonContract(id: number): void {
    this.act((s) => TR.abandonContract(s, id), () => this.audio.denied());
  }

  rerollBoard(): void {
    this.act(TR.rerollBoard, () => this.audio.blip());
  }

  // ------------------------------------------------------------ fold drive

  feedDrive(): void {
    this.act((s) => F.feedDrive(s) > 0, () => this.audio.buy());
  }

  toggleAutoFeed(): void {
    const s = this._state();
    if (!s) return;
    s.fold.autoFeed = !s.fold.autoFeed;
    this.audio.blip();
    this.publish();
  }

  useFoldCell(): void {
    this.act(F.useFoldCell, () => this.audio.buy());
  }

  buyCore(id: string): void {
    this.act((s) => F.buyCore(s, id), () => this.audio.select());
  }

  toggleArchive(id: string): void {
    this.act((s) => F.toggleArchive(s, id), () => this.audio.blip());
  }

  setDestination(i: number): void {
    const s = this._state();
    if (!s) return;
    s.fold.destination = i;
    this.audio.blip();
    this.publish();
  }

  /** Arm the drive and play the jump; the sector changes at the white flash. */
  startJump(deep = false): void {
    const s = this._state();
    if (!s || this.jump() || F.canJump(s) !== null || (deep && F.canDeepFold(s) !== null)) {
      this.audio.denied();
      return;
    }
    const dest = S.destinationPreview(s, F.destinationCount(s))[s.fold.destination] ?? S.destinationPreview(s)[0];
    const seq: JumpSequence = {
      phase: 'arm',
      count: 3,
      from: `${s.sector.code} · ${s.sector.name}`,
      to: deep ? 'THE DEEP FOLD · DEPTH 01' : `${dest.def.code} · ${dest.def.name}`,
      gained: deep ? F.deepFoldGain(s) : F.resonanceGain(s),
      deep,
    };
    const quick = this.settings.reducedMotion();
    const t = (ms: number) => (quick ? Math.min(ms, 400) : ms);
    this.save();
    this.audio.klaxon();
    this.jump.set(seq);
    const steps: [number, () => void][] = [
      [t(2400), () => this.jump.set({ ...seq, phase: 'farewell' })],
      [t(2600), () => this.jump.set({ ...seq, phase: 'countdown', count: 3 })],
      [t(1000), () => this.jump.set({ ...seq, phase: 'countdown', count: 2 })],
      [t(1000), () => this.jump.set({ ...seq, phase: 'countdown', count: 1 })],
      [t(1000), () => {
        this.audio.overdrive();
        this.jump.set({ ...seq, phase: 'tunnel' });
      }],
      [t(2600), () => {
        this.audio.crack();
        this.jump.set({ ...seq, phase: 'flash' });
        this.completeJump(seq.deep);
      }],
      [t(700), () => this.jump.set(null)],
    ];
    let delay = 0;
    for (const [ms, fn] of steps) {
      delay += ms;
      setTimeout(fn, delay);
    }
  }

  private completeJump(deep = false): void {
    const s = this._state();
    if (!s) return;
    const r = F.foldJump(s, Date.now(), deep);
    if (!r) return;
    this.comms.set([]);
    this._state.set(r.state);
    this.tab.set('ops');
    this.offlineReport.set(null);
    this.save();
    // Episodes the jump itself unlocks (the first jump is Episode 8) queue up quietly.
    ST.advanceStory(r.state, this.blankEvents());
    const lines = r.first ? ARRIVAL.first : [ARRIVAL.later[r.state.fold.jumps % ARRIVAL.later.length]];
    const def = S.sectorOf(r.state);
    const next = episodeDef(r.state.story.unlocked + 1);
    const pending = ST.pendingEpisode(r.state);
    // Episode 8 tells the first jump's story itself.
    const quiet = pending !== null && r.first;
    this.episode.set({
      number: r.state.fold.jumps + 1,
      label: deep ? `DEEP FOLD ${String(r.state.fold.deepFolds).padStart(2, '0')}` : `FOLD JUMP ${String(r.state.fold.jumps).padStart(2, '0')}`,
      teaser: pending
        ? `NOW PLAYING · EPISODE ${pending}: ${episodeDef(pending)!.title}`
        : ST.pendingEpilogue(r.state)
          ? `EPILOGUE · ${EPILOGUE.title}`
          : ST.pendingMasterEnding(r.state)
            ? `EPILOGUE · ${MASTER_EPILOGUE.title}`
            : ST.pendingOffer(r.state)
              ? `SECOND CHANCE · ${LAST_OFFER.title}`
          : next
            ? `NEXT EPISODE · ${next.title}`
            : undefined,
      title: def.name,
      subtitle: deep
        ? `Sector ${def.code} · ${S.starLabel(def)} · +${r.echoes} Echo${r.echoes === 1 ? '' : 'es'}`
        : `Sector ${def.code} · ${S.starLabel(def)} · +${r.gained} Fold Resonance`,
      arrival: [
        ...(quiet ? [] : ([['VESPER', lines[0]]] as [Speaker, string][])),
        ...(lines[1] && !quiet ? ([['JUNO', lines[1]]] as [Speaker, string][]) : []),
        deep
          ? ([
              'VESPER',
              `Deep Fold complete. The Resonance layer collapsed into ${r.echoes} Echo${r.echoes === 1 ? '' : 'es'} (${r.state.fold.echoes} in all). Every jump now pays ×${(1 + r.state.fold.echoes * 0.1).toFixed(1)} Resonance.`,
            ] as [Speaker, string])
          : ['VESPER', `Fold Resonance +${r.gained}. Production is now ×${F.resonanceMult(r.state).toFixed(2)} from Resonance. Spend it in the FOLD tab's Jump Core.`],
        ...(ST.pendingEpilogue(r.state)
          ? ([['VESPER', 'We have reached the edge of the charted frontier. Incoming transmission: the Epilogue. Press PLAY in the comm log when you are ready.']] as [Speaker, string][])
          : []),
        ...(ST.pendingMasterEnding(r.state)
          ? ([['VESPER', 'The first Deep Fold is complete. Incoming transmission: the Epilogue. Press PLAY in the comm log when you are ready.']] as [Speaker, string][])
          : []),
        ...(ST.pendingOffer(r.state)
          ? ([['VESPER', 'A red frame is holding off the bow, not attacking. She wants to talk. Press PLAY in the comm log.']] as [Speaker, string][])
          : []),
      ],
    });
  }

  rebuildWrecks(type: DT): void {
    this.act((s) => T.rebuildWrecks(s, type) > 0, () => this.audio.buy());
  }

  private blankEvents(): TickEvents {
    return {
      research: [],
      levelUps: [],
      syncUps: [],
      autoRepairs: [],
      repairStalled: [],
      assistantStarted: [],
      threatStarted: [],
      threatResolved: [],
      anomaly: [],
      trade: [],
      ingots: E.emptyOre(),
      alloys: 0,
      charted: [],
      autoSoldCredits: 0,
      story: [],
    };
  }

  // ------------------------------------------------------------ story

  private fill(text: string): string {
    const s = this._state();
    return text.replaceAll('{ship}', s?.ship ?? 'ship').replaceAll('{cmdr}', s?.commander ?? 'Commander');
  }

  /** Plays an episode: the next pending one, or a replay of one already watched. */
  playEpisode(n?: number): void {
    const s = this._state();
    if (!s) return;
    const num = n ?? ST.pendingEpisode(s);
    // Replays anything watched; new episodes only in order.
    if (!num || num > s.story.unlocked || num > s.story.watched + 1) return;
    const def = episodeDef(num)!;
    this.audio.select();
    this.scene.set({
      kind: 'episode',
      n: num,
      label: `EPISODE ${String(num).padStart(2, '0')}`,
      title: def.title,
      act: ACTS[def.act],
      lines: def.lines.map(([w, t]) => [w, this.fill(t)] as [Speaker, string]),
      index: -1,
      replay: num <= s.story.watched,
      finale: num === FINAL_EPISODE && !s.story.choice,
      setting: sceneSetting('episode', num),
    });
  }

  /** Master the Cycle's ending, at the first Deep Fold. */
  playMasterEnding(): void {
    const s = this._state();
    if (!s || !s.story.masterEnding) return;
    this.audio.select();
    this.scene.set({
      kind: 'master_epilogue',
      n: 0,
      label: 'EPILOGUE',
      title: MASTER_EPILOGUE.title,
      act: 'The cycle, mastered',
      lines: MASTER_EPILOGUE.lines.map(([w, t]) => [w, this.fill(t)] as [Speaker, string]),
      index: -1,
      replay: s.story.masterEnding === 2,
      finale: false,
      setting: 'void',
    });
  }

  /** The Jackal's last offer: ends on the same two doors as the finale. */
  playOffer(): void {
    const s = this._state();
    if (!s || !ST.pendingOffer(s)) return;
    this.audio.select();
    this.scene.set({
      kind: 'offer',
      n: 0,
      label: 'SECOND CHANCE',
      title: LAST_OFFER.title,
      act: 'After the harvest',
      lines: LAST_OFFER.lines.map(([w, t]) => [w, this.fill(t)] as [Speaker, string]),
      index: -1,
      replay: false,
      finale: true,
      setting: 'battle',
    });
  }

  /** Break the Cycle's ending, at the charted frontier. */
  playEpilogue(): void {
    const s = this._state();
    if (!s || !s.story.epilogue) return;
    this.audio.select();
    this.scene.set({
      kind: 'epilogue',
      n: 0,
      label: 'EPILOGUE',
      title: EPILOGUE.title,
      act: 'Beyond the frontier',
      lines: EPILOGUE.lines.map(([w, t]) => [w, this.fill(t)] as [Speaker, string]),
      index: -1,
      replay: s.story.epilogue === 2,
      finale: false,
      setting: 'nebula',
    });
  }

  playSide(n?: number): void {
    const s = this._state();
    if (!s) return;
    const num = n ?? ST.pendingSide(s);
    if (!num || num > s.story.side || num > s.story.sideWatched + 1) return;
    const def = ST.sideStory(num);
    this.audio.select();
    this.scene.set({
      kind: 'side',
      n: num,
      label: `SIDE STORY ${String(num).padStart(2, '0')}`,
      title: def.title,
      act: 'Between the folds',
      lines: def.lines.map(([w, t]) => [w, this.fill(t)] as [Speaker, string]),
      index: -1,
      replay: num <= s.story.sideWatched,
      finale: false,
      setting: sceneSetting('side', num),
    });
  }

  advanceScene(): void {
    const sc = this.scene();
    if (!sc) return;
    const last = sc.lines.length - 1;
    if (sc.index < last) {
      this.audio.comm(SPEAKER_PITCH[sc.lines[sc.index + 1][0]]);
      this.scene.set({ ...sc, index: sc.index + 1 });
    } else if (sc.finale) {
      // Wait on the choice screen.
      if (sc.index === last) this.scene.set({ ...sc, index: last + 1 });
    } else {
      this.endScene();
    }
  }

  /** Skips to the end (or to the finale choice, which can't be skipped). */
  skipScene(): void {
    const sc = this.scene();
    if (!sc) return;
    if (sc.finale) this.scene.set({ ...sc, index: sc.lines.length });
    else this.endScene();
  }

  private endScene(): void {
    const sc = this.scene();
    const s = this._state();
    this.scene.set(null);
    if (!sc || !s || sc.replay) return;
    if (sc.kind === 'episode') ST.watchEpisode(s, sc.n);
    else if (sc.kind === 'epilogue') ST.watchEpilogue(s);
    else if (sc.kind === 'master_epilogue') ST.watchMasterEnding(s);
    else if (sc.kind === 'offer') return;
    else ST.watchSide(s, sc.n);
    this.publish();
    this.save();
  }

  chooseFinale(c: FinaleChoice): void {
    const s = this._state();
    if (!s) return;
    if (this.scene()?.kind === 'offer') {
      if (!ST.answerOffer(s, c)) return;
      this.scene.set(null);
      this.audio.overdrive();
      (c === 'break' ? LAST_OFFER.accept : LAST_OFFER.decline).forEach(([w, t], i) => this.say(w, this.fill(t), 400 + i * 2000));
      this.publish();
      this.save();
      return;
    }
    if (!ST.chooseFinale(s, c)) return;
    this.scene.set(null);
    this.audio.overdrive();
    FINALE[c].aftermath.forEach(([w, t], i) => this.say(w, this.fill(t), 400 + i * 2000));
    this.publish();
    this.save();
  }

  private storySay(items: { kind: 'episode' | 'medal'; id: string; text: string }[]): void {
    const eps = items.filter((x) => x.kind === 'episode');
    const medals = items.filter((x) => x.kind === 'medal');
    if (eps.length) this.alert(eps.length === 1 ? `Episode ${eps[0].id} is ready: ${eps[0].text}` : `${eps.length} episodes are ready`);
    if (eps.length === 1) {
      this.say('VESPER', `Incoming transmission: Episode ${eps[0].id}, "${eps[0].text}". Press PLAY in the comm log when you're ready.`);
    } else if (eps.length > 1) {
      this.say('VESPER', `${eps.length} episodes are waiting. Press PLAY in the comm log, or browse them in the ARCHIVE.`);
    }
    if (eps.length) this.audio.select();
    if (medals.length > 3) {
      this.say('SYSTEM', `★ ${medals.length} commendations awarded. Review them in the ARCHIVE.`);
    } else {
      for (const m of medals) {
        const def = medalDef(m.id)!;
        this.say('SYSTEM', `★ COMMENDATION · ${def.name}: ${def.desc} (+${Math.round(def.bonus.amount * 100)}% ${BONUS_LABEL[def.bonus.kind]})`);
      }
    }
    if (medals.length) this.audio.dataCore();
  }

  // ------------------------------------------------------------ presentation

  /** A Special Technique cut-in, respecting the cut-in setting. */
  showCutIn(c: CutIn): void {
    if (this.settings.settings().cutIns === 'off') return;
    this.cutIn.set(c);
  }

  /** Once per sector, after 15 minutes there: the "A-part / B-part" eyecatch. */
  private checkEyecatch(s: GameState): void {
    if (!this.settings.settings().eyecatch || this.eyecatch()) return;
    const log = ST.currentLog(s);
    if (!log || s.playtimeSec - log.arrived < 900) return;
    const key = `eyecatch:${log.code}:${log.arrived}`;
    if (s.flags[key]) return;
    // Never on top of something else.
    if (this.episode() || this.scene() || this.jump() || this.sortie() || this.cutIn() || this.offlineReport()) return;
    // Take the looks in turn: count the eyecatches this save has already seen.
    const seen = Object.keys(s.flags).filter((k) => k.startsWith('eyecatch:') && s.flags[k]).length;
    s.flags[key] = true;
    this.eyecatchVariant.set(seen % 3);
    this.eyecatch.set(true);
    setTimeout(() => this.eyecatch.set(false), this.settings.reducedMotion() ? 1500 : 3200);
  }

  private titleTimer: ReturnType<typeof setInterval> | null = null;

  /** Urgent news while the tab is in the background: flash the title and/or notify. */
  private alert(text: string): void {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') return;
    const set = this.settings.settings();
    if (set.notifications && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('Fold Drive Miner', { body: text, tag: 'fdm-alert' });
      } catch {
        // Some browsers only allow notifications from a service worker.
      }
    }
    if (!set.tabAlerts || this.titleTimer) return;
    const original = document.title;
    let on = false;
    this.titleTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        document.title = original;
        if (this.titleTimer) clearInterval(this.titleTimer);
        this.titleTimer = null;
        return;
      }
      on = !on;
      document.title = on ? `⚠ ${text}` : original;
    }, 1000);
  }

  // ------------------------------------------------------------ comms

  /** What the comm log calls the Jackal: her title, and her name once her face is known. */
  private jackalName(s: GameState): string {
    return (s.story?.watched ?? 0) >= JACKAL.revealEpisode ? 'REI VASHTI — THE JACKAL' : JACKAL.name.toUpperCase();
  }

  private sayPirate(id: CaptainId, text: string, delayMs = 0): void {
    this.say('PIRATE', text, delayMs, undefined, captainDef(id).name.toUpperCase(), id);
  }

  say(from: Speaker, text: string, delayMs = 0, pilot?: PilotState, name?: string, look?: string): void {
    const push = () => {
      if (this.settings.settings().commBleeps) this.audio.comm(SPEAKER_PITCH[from]);
      const msg: CommMessage = { id: ++this.commId, from, text, at: Date.now() };
      if (name) msg.name = name;
      if (look) msg.look = look;
      if (from === 'PILOT' && pilot) {
        msg.name = `${pilot.name} "${pilot.callsign}"`;
        msg.seed = pilot.portraitSeed;
      }
      this.comms.update((list) => [...list, msg].slice(-40));
    };
    if (delayMs > 0) setTimeout(push, delayMs);
    else push();
  }

  private checkHints(s: GameState): void {
    const once = (flag: string, from: Speaker, text: string) => {
      if (s.flags[flag]) return;
      s.flags[flag] = true;
      this.say(from, text);
    };
    if (s.credits >= E.droneCost(s) && s.drones.prospector === 0) {
      once('hintDrone', 'VESPER', 'Credits sufficient for a Prospector drone. Recommend deployment.');
    }
    if (E.cargoUsed(s) >= E.cargoCapacity(s) - 1e-6) {
      once('hintCargo', 'VESPER', 'Cargo hold full. Mining output is being lost. Sell ore or expand the hold.');
    }
    const tier = E.nextTierUpgrade(s);
    if (tier && s.credits >= tier.cost * 0.5) {
      once('hintTier', 'JUNO', `Commander, with ${this.fmt(tier.cost)} credits we could refit to a ${tier.name}. Just saying!`);
    }
    if (s.surveyData > 0) {
      once('hintLab', 'VESPER', 'Survey Data recovered from the cracked asteroid. The LAB is now online — spend it on research.');
    }
    if (s.surveyData >= S.scanCost(s, 1).sd && S.chartedZones(s) === 1 && !s.sector.scan) {
      once('hintScan', 'VESPER', 'Enough Survey Data for a sector scan. Open the MAP to chart the next zone.');
    }
  }
}
