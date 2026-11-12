import { Component, computed, inject } from '@angular/core';
import { ALLOYS } from '../game/alloy-data';
import { SPECIAL } from '../game/special-data';
import { CONFIG, ORES, OreId } from '../game/config';
import { DRONES, DRONE_IDS } from '../game/fleet-data';
import { DroneSprite } from '../ui/drone-sprite';
import * as E from '../game/engine';
import { formatDuration } from '../game/format';
import { GameService } from '../services/game.service';

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/** The OPS tab: cargo & market, refinery, drill upgrades, drone bay. */
@Component({
  selector: 'fdm-ops-panel',
  imports: [DroneSprite],
  templateUrl: './ops-panel.html',
  styleUrl: './ops-panel.scss',
})
export class OpsPanel {
  protected readonly game = inject(GameService);
  protected readonly s = computed(() => this.game.state()!);
  protected readonly roman = ROMAN;

  protected readonly hasAutoSell = computed(() => E.hasResearch(this.s(), 'auto_sell'));
  protected readonly hasAnalysis = computed(() => E.hasResearch(this.s(), 'market_analysis'));

  /** Ores shown in the hold: everything reachable, plus the next tier as a teaser. */
  protected readonly cargoRows = computed(() => {
    const s = this.s();
    const analysis = this.hasAnalysis();
    return ORES.filter((o) => o.tier <= Math.max(E.drillTier(s) + 1, 2) || s.cargo[o.id] > 0).map((o) => {
      const fc = analysis ? E.priceForecast(s, o.id) : null;
      return {
        ore: o,
        amount: s.cargo[o.id],
        ingots: s.ingots[o.id],
        price: E.orePrice(s, o.id),
        ingotPrice: E.ingotPrice(s, o.id),
        mult: E.marketMultiplier(s.marketClock, o.id),
        trend: E.priceTrend(s, o.id),
        forecast: fc && fc.inSec > 0 ? fc : null,
        locked: !E.oreReachable(s, o.id),
        autoOre: s.autoSell.ore[o.id],
        autoIngot: s.autoSell.ingot[o.id],
      };
    });
  });

  protected readonly cargoValue = computed(
    () =>
      this.cargoRows().reduce((sum, r) => sum + Math.floor(r.amount) * r.price + Math.floor(r.ingots) * r.ingotPrice, 0) +
      this.alloyRows().reduce((sum, r) => sum + Math.floor(r.amount) * r.price, 0),
  );

  // ---------------------------------------------------------------- alloys
  protected readonly hasForge = computed(() => E.hasForge(this.s()));
  /** Alloy stock and prices, for every recipe the drill can reach. */
  protected readonly alloyRows = computed(() => {
    const s = this.s();
    if (!E.hasForge(s)) return [];
    return ALLOYS.filter((a) => E.recipeOpen(s, a) || s.alloys[a.id] > 0).map((a) => ({
      alloy: a,
      amount: s.alloys[a.id],
      price: E.alloyPrice(s, a.id),
      auto: s.autoSell.alloy[a.id],
      inputs: a.inputs.map((o) => ORES.find((x) => x.id === o)!),
      ready: E.forgeable(s, a.id),
    }));
  });
  protected readonly forge = computed(() => {
    const f = this.s().forge;
    const alloy = f.alloy ? ALLOYS.find((a) => a.id === f.alloy)! : null;
    return {
      f,
      alloy,
      inputs: alloy ? alloy.inputs.map((o) => ORES.find((x) => x.id === o)!.name).join(' and ') : '',
      running: f.batch > 0,
      progress: f.batch > 0 ? 1 - f.remaining / f.duration : 0,
      eta: formatDuration(f.remaining),
      waiting: f.batch === 0 && f.repeat && !!f.alloy,
    };
  });
  protected readonly forgeCap = computed(() => E.forgeCapacity(this.s()));
  protected readonly forgeTime = computed(() => formatDuration(E.forgeDuration(this.s())));
  protected readonly alloyMult = computed(() => E.alloyValueMult(this.s()));

  /** What's taking up the hold: ore, finished ingots (1 t each) and furnace output reserved. */
  protected readonly load = computed(() => {
    const s = this.s();
    const sum = (a: Record<string, number>) => Object.values(a).reduce((x, y) => x + y, 0);
    return {
      ore: sum(s.cargo),
      ingots: sum(s.ingots),
      alloys: sum(s.alloys),
      reserved: E.refineryReserved(s) + E.forgeReserved(s),
    };
  });

  protected readonly cargoPct = computed(() => Math.min(100, (this.game.used() / this.game.capacity()) * 100));
  protected readonly cargoCost = computed(() => E.cargoUpgradeCost(this.s()));
  protected readonly nextCapacity = computed(() => E.cargoCapacity(this.s(), this.s().cargoLevel + 1));

  // ---------------------------------------------------------------- refinery
  protected readonly hasRefinery = computed(() => E.hasResearch(this.s(), 'refinery'));
  protected readonly hasAutoRefine = computed(() => E.hasResearch(this.s(), 'auto_refine'));
  protected readonly ratio = computed(() => E.oreRatio(this.s()));
  protected readonly batchCap = computed(() => E.batchCapacity(this.s()));
  protected readonly nextBatchCap = computed(() => E.batchCapacity(this.s(), this.s().refinery.capacityLevel + 1));
  protected readonly furnaceCost = computed(() => E.furnaceCapacityCost(this.s()));
  protected readonly batchTime = computed(() => formatDuration(E.batchDuration(this.s())));
  protected readonly ingotMult = CONFIG.refinery.ingotValueMult;
  protected readonly anyRunning = computed(() => this.s().refinery.slots.some((x) => x.batch > 0));
  protected readonly refinableOres = computed(() => ORES.filter((o) => E.oreReachable(this.s(), o.id)));
  protected readonly slots = computed(() => {
    const s = this.s();
    const ratio = this.ratio();
    return s.refinery.slots.map((slot, i) => ({
      i,
      slot,
      ore: slot.ore ? ORES.find((o) => o.id === slot.ore)! : null,
      running: slot.batch > 0,
      progress: slot.batch > 0 ? 1 - slot.remaining / slot.duration : 0,
      eta: formatDuration(slot.remaining),
      ingots: slot.batch / ratio,
      waiting: slot.batch === 0 && slot.repeat && !!slot.ore,
    }));
  });

  // ---------------------------------------------------------------- drill
  protected readonly powerCost = computed(() => E.drillPowerCost(this.s()));
  protected readonly nextPower = computed(() => {
    const s = this.s();
    return E.drillPower({ ...s, drill: { ...s.drill, powerLevel: s.drill.powerLevel + 1 } });
  });
  protected readonly tierUp = computed(() => E.nextTierUpgrade(this.s()));
  protected readonly sinkCost = computed(() => E.heatSinkCost(this.s()));
  protected readonly sinkMax = CONFIG.heat.sinkMaxLevel;
  protected readonly clampCost = CONFIG.hold.cost;
  protected readonly arrayCost = computed(() => E.sensorArrayCost(this.s()));
  protected readonly arrayMax = SPECIAL.arrayMaxLevel;
  /** Chance the next rock in this zone is special. */
  protected readonly specialOdds = computed(() => (E.specialChance(this.s(), E.currentZone(this.s())) * 100).toFixed(1));
  protected readonly nextOdds = computed(() => {
    const s = this.s();
    return (E.specialChance({ ...s, sensorArray: (s.sensorArray ?? 0) + 1 }, E.currentZone(s)) * 100).toFixed(1);
  });
  protected readonly holdRate = computed(() => (1 / E.holdInterval(this.s())).toFixed(1));
  protected readonly cargoMax = CONFIG.cargo.maxLevel;
  protected readonly furnaceMax = CONFIG.refinery.maxBatchLevel;
  protected readonly odMult = computed(() => E.overdriveMult(this.s()));
  protected readonly drillTier = computed(() => E.drillTier(this.s()));
  /** The next drill tier that comes from research, if any. */
  protected readonly researchTier = computed(() => {
    const t = E.drillTier(this.s());
    if (t === 2) return { name: 'Drill Mk.III', node: 'drill_mk3', ore: 'Iridium' };
    if (t === 3) return { name: 'Drill Mk.IV', node: 'drill_mk4', ore: 'Helium-3' };
    if (t === 4) return { name: 'Drill Mk.V', node: 'drill_mk5', ore: 'Voidglass' };
    return null;
  });

  // ---------------------------------------------------------------- drones
  protected readonly droneCount = computed(() => DRONE_IDS.reduce((n, id) => n + this.s().drones[id], 0));
  protected readonly droneRows = computed(() => {
    const s = this.s();
    return DRONES.map((def) => {
      const count = s.drones[def.id];
      const unlocked = E.droneUnlocked(s, def.id);
      const mult = E.droneMultiplier(count);
      return {
        def,
        count,
        unlocked,
        lockText: def.teaser ? `Arrives in ${def.teaser}` : `Research ${def.name} drones in the LAB`,
        effect: def.orePerSec > 0 ? `${this.game.fmt(E.perDroneRateOf(s, def.id))} ore/s each · ${def.role}` : def.role,
        mult,
        next: def.orePerSec > 0 || def.id === 'surveyor' ? E.nextDroneMilestone(count) : null,
        cost1: E.droneCostOf(s, def.id, 1),
        cost10: E.droneCostOf(s, def.id, 10),
        max: unlocked ? E.maxAffordableOf(s, def.id) : 0,
      };
    }).filter((r) => r.unlocked || r.def.id !== 'guardian' || this.s().drones.prospector >= 10);
  });

  protected trendGlyph(t: number): string {
    return t > 0 ? '▲' : t < 0 ? '▼' : '■';
  }

  protected canBatch(ore: OreId): boolean {
    return this.s().cargo[ore] >= this.ratio();
  }

  protected openLab(): void {
    this.game.tab.set('lab');
  }
}
