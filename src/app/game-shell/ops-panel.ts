import { Component, computed, inject } from '@angular/core';
import { CONFIG, ORES, OreId } from '../game/config';
import * as E from '../game/engine';
import { formatDuration } from '../game/format';
import { GameService } from '../services/game.service';

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/** The OPS tab: cargo & market, refinery, drill upgrades, drone bay. */
@Component({
  selector: 'fdm-ops-panel',
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
    return ORES.filter((o) => o.tier <= Math.max(s.drill.tier + 1, 2) && o.tier <= 4).map((o) => {
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

  protected readonly cargoValue = computed(() =>
    this.cargoRows().reduce((sum, r) => sum + Math.floor(r.amount) * r.price + Math.floor(r.ingots) * r.ingotPrice, 0),
  );

  protected readonly cargoPct = computed(() => (this.game.used() / this.game.capacity()) * 100);
  protected readonly cargoCost = computed(() => E.cargoUpgradeCost(this.s()));
  protected readonly nextCapacity = computed(() => E.cargoCapacity(this.s(), this.s().cargoLevel + 1));

  // ---------------------------------------------------------------- refinery
  protected readonly hasRefinery = computed(() => E.hasResearch(this.s(), 'refinery'));
  protected readonly hasAutoRefine = computed(() => E.hasResearch(this.s(), 'auto_refine'));
  protected readonly ratio = computed(() => E.oreRatio(this.s()));
  protected readonly batchCap = computed(() => E.batchCapacity(this.s()));
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
  protected readonly odMult = computed(() => E.overdriveMult(this.s()));
  /** The next drill tier that comes from research, if any. */
  protected readonly researchTier = computed(() => {
    const t = this.s().drill.tier;
    if (t === 2) return { name: 'Drill Mk.III', node: 'drill_mk3', ore: 'Iridium' };
    if (t === 3) return { name: 'Drill Mk.IV', node: 'drill_mk4', ore: 'Helium-3' };
    return null;
  });

  // ---------------------------------------------------------------- drones
  protected readonly droneCount = computed(() => this.s().drones.prospector);
  protected readonly droneCost1 = computed(() => E.droneCost(this.s(), 1));
  protected readonly droneCost10 = computed(() => E.droneCost(this.s(), 10));
  protected readonly droneMax = computed(() => E.maxAffordableDrones(this.s()));
  protected readonly droneMult = computed(() => E.droneMultiplier(this.droneCount()));
  protected readonly nextMilestone = computed(() => E.nextDroneMilestone(this.droneCount()));
  protected readonly perDrone = computed(() => E.perDroneRate(this.s()));
  protected readonly droneName = CONFIG.drones.prospector.name;

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
