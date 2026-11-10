import { Component, computed, inject } from '@angular/core';
import { CONFIG, ORES } from '../game/config';
import * as E from '../game/engine';
import { GameService } from '../services/game.service';

/** The OPS tab: cargo & market, drill upgrades, drone bay. */
@Component({
  selector: 'fdm-ops-panel',
  templateUrl: './ops-panel.html',
  styleUrl: './ops-panel.scss',
})
export class OpsPanel {
  protected readonly game = inject(GameService);
  protected readonly s = computed(() => this.game.state()!);

  protected readonly cargoRows = computed(() => {
    const s = this.s();
    return ORES.filter((o) => o.tier <= Math.max(s.drill.tier, 2)).map((o) => ({
      ore: o,
      amount: s.cargo[o.id],
      price: E.orePrice(s, o.id),
      trend: E.priceTrend(s, o.id),
      locked: o.tier > s.drill.tier,
    }));
  });

  protected readonly cargoValue = computed(() =>
    this.cargoRows().reduce((sum, r) => sum + Math.floor(r.amount) * r.price, 0),
  );

  protected readonly cargoPct = computed(() => (this.game.used() / this.game.capacity()) * 100);
  protected readonly cargoCost = computed(() => E.cargoUpgradeCost(this.s()));
  protected readonly nextCapacity = computed(() =>
    Math.floor(CONFIG.cargo.baseCapacity * CONFIG.cargo.capacityGrowth ** (this.s().cargoLevel + 1)),
  );

  protected readonly powerCost = computed(() => E.drillPowerCost(this.s()));
  protected readonly nextPower = computed(() => {
    const s = this.s();
    return E.drillPower({ ...s, drill: { ...s.drill, powerLevel: s.drill.powerLevel + 1 } });
  });
  protected readonly tierUp = computed(() => E.nextTierUpgrade(this.s()));
  protected readonly sinkCost = computed(() => E.heatSinkCost(this.s()));
  protected readonly sinkMax = CONFIG.heat.sinkMaxLevel;

  protected readonly droneCount = computed(() => this.s().drones.prospector);
  protected readonly droneCost1 = computed(() => E.droneCost(this.s(), 1));
  protected readonly droneCost10 = computed(() => E.droneCost(this.s(), 10));
  protected readonly droneMax = computed(() => E.maxAffordableDrones(this.s()));
  protected readonly droneMult = computed(() => E.droneMultiplier(this.droneCount()));
  protected readonly nextMilestone = computed(() => E.nextDroneMilestone(this.droneCount()));
  protected readonly perDrone = computed(
    () => CONFIG.drones.prospector.orePerSec * this.droneMult(),
  );
  protected readonly droneName = CONFIG.drones.prospector.name;
}
