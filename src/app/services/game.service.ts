import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { CONFIG, OreId, ZoneId, zoneDef } from '../game/config';
import * as E from '../game/engine';
import { formatNumber } from '../game/format';
import { researchNode } from '../game/research';
import { randomSeed } from '../game/rng';
import { ClickResult, GameState, MechJob, OfflineReport, PilotState, TickEvents } from '../game/types';
import { PostId, postDef } from '../game/crew-data';
import { DroneType, FrameId, SlotId, frameDef } from '../game/fleet-data';
import { AudioService } from './audio.service';
import { SaveService } from './save.service';
import { SettingsService } from './settings.service';

export type Tab = 'ops' | 'lab' | 'map' | 'hangar' | 'crew';

export type Speaker = 'VESPER' | 'JUNO' | 'KIT' | 'SYSTEM' | 'PILOT';

export interface CommMessage {
  id: number;
  from: Speaker;
  /** Display name for generated pilots. */
  name?: string;
  /** Portrait seed for generated pilots. */
  seed?: number;
  text: string;
  at: number;
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

export interface EpisodeCard {
  number: number;
  title: string;
  subtitle: string;
}

const SPEAKER_PITCH: Record<Speaker, number> = { VESPER: 420, JUNO: 760, KIT: 640, SYSTEM: 300, PILOT: 560 };

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

  // Derived values used across the HUD.
  readonly power = computed(() => this.withState(E.drillPower, 0));
  readonly capacity = computed(() => this.withState(E.cargoCapacity, 0));
  readonly used = computed(() => this.withState(E.cargoUsed, 0));
  readonly cargoFull = computed(() => this.used() >= this.capacity() - 1e-6);
  readonly droneRate = computed(() => this.withState(E.droneRateTotal, 0));
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
    this.episode.set(null);
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
    if (this.sinceSave >= CONFIG.save.autosaveSec) {
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
    }
    this.publish();
    return r;
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

  sellIngots(ore: OreId): void {
    this.act((s) => E.sellIngots(s, ore) > 0, () => this.audio.sell());
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
      case 'survey_trojan':
        this.say('VESPER', 'New survey zone charted. Open the MAP to change course.', 1500);
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
    this.cutIn.set({
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

  // ------------------------------------------------------------ comms

  say(from: Speaker, text: string, delayMs = 0, pilot?: PilotState): void {
    const push = () => {
      this.audio.comm(SPEAKER_PITCH[from]);
      const msg: CommMessage = { id: ++this.commId, from, text, at: Date.now() };
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
  }
}
