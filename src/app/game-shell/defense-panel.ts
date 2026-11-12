import { Component, computed, inject, untracked } from '@angular/core';
import * as E from '../game/engine';
import { DRONES, droneDef } from '../game/fleet-data';
import { formatDuration } from '../game/format';
import { CAPTAINS, JACKAL, RaidOrder, FlareOrder, RogueOrder, THREAT } from '../game/threat-data';
import * as T from '../game/threat-rules';
import { GameService } from '../services/game.service';
import { DroneSprite } from '../ui/drone-sprite';
import { MechPortrait } from '../ui/mech-portrait';
import { PilotPortrait } from '../ui/pilot-portrait';

/** The DEFENSE tab: Pirate Heat, standing orders, defense roster, the pirate base, the Jackal and the event log. */
@Component({
  selector: 'fdm-defense-panel',
  imports: [MechPortrait, PilotPortrait, DroneSprite],
  templateUrl: './defense-panel.html',
  styleUrl: './defense-panel.scss',
})
export class DefensePanel {
  protected readonly game = inject(GameService);
  protected readonly s = computed(() => this.game.state()!);
  protected readonly t = computed(() => this.s().threats);
  protected readonly jackalName = JACKAL.name;
  /** Rival captains met so far, for the wanted board. */
  protected readonly rivals = computed(() =>
    CAPTAINS.map((c) => ({ c, met: this.t().captains?.[c.id] ?? 0 })).filter((r) => r.met > 0),
  );
  /** Once the Jackal is out, the rivals fly for her. */
  protected readonly jackalRules = computed(() => this.t().jackalEncounters > 0 && this.s().fold.jumps >= 1);

  protected readonly raidOrders: { id: RaidOrder; label: string; hint: string }[] = [
    { id: 'defend', label: 'Defend', hint: 'Mechs on DEFENSE standby + Guardians fight' },
    { id: 'defend_all', label: 'Scramble all', hint: 'Mining mechs join the fight too' },
    { id: 'surrender', label: 'Surrender', hint: `Hand over ${THREAT.raid.surrenderCargo * 100}% of the hold` },
  ];
  protected readonly flareOrders: { id: FlareOrder; label: string; hint: string }[] = [
    { id: 'shelter', label: 'Shelter', hint: 'Drones stop mining for the flare' },
    { id: 'ride', label: 'Ride it out', hint: `Keep mining, lose ~${THREAT.flare.rideLoss * 100}% of drones` },
  ];
  protected readonly rogueOrders: { id: RogueOrder; label: string; hint: string }[] = [
    { id: 'intercept', label: 'Intercept', hint: 'Best available mech tries to break it' },
    { id: 'ignore', label: 'Brace', hint: 'Take the impact' },
  ];

  protected readonly heatLevel = computed(() => {
    const h = this.t().heat;
    return h < 25 ? 'LOW' : h < 50 ? 'ELEVATED' : h < 75 ? 'HIGH' : 'EXTREME';
  });

  protected readonly graceLeft = computed(() => Math.max(0, THREAT.graceSec - this.t().clock));

  protected readonly roster = computed(() => {
    const s = this.s();
    return s.mechs.map((m) => ({
      mech: m,
      power: T.mechCombatPower(s, m),
      ok: T.canFight(s, m),
      pilot: E.mechPilot(s, m),
      cond: E.mechCondition(s, m),
    }));
  });

  protected readonly expected = computed(() => T.raidStrength(this.s()));
  /** Both sides of a raid as the fight actually works: damage per round against hull and armor. */
  protected readonly matchup = computed(() => {
    const s = this.s();
    return T.raidMatchup(s, T.defenders(s, s.threats.orders.raid === 'defend_all'), s.drones.guardian, T.raidStrength(s));
  });
  protected readonly guardians = computed(() => ({
    count: this.s().drones.guardian,
    power: this.s().drones.guardian * T.guardianPower(this.s()),
    unlocked: E.droneUnlocked(this.s(), 'guardian'),
  }));

  protected readonly wrecks = computed(() => {
    const s = this.s();
    return DRONES.filter((d) => s.wrecks[d.id] >= 1).map((d) => ({
      def: droneDef(d.id),
      count: Math.floor(s.wrecks[d.id]),
      cost: T.wreckRebuildCost(s, d.id),
    }));
  });

  /** Re-run the (simulation-based) odds every 2 game seconds, not every tick. */
  private readonly slow = computed(() => Math.floor(this.t().clock / 2));
  protected readonly odds = computed(() => {
    this.slow();
    const s = untracked(() => this.s());
    const mechs = T.defenders(s, s.threats.orders.raid === 'defend_all');
    if (!mechs.length && !s.drones.guardian) return null;
    return T.riskPreview(s, mechs, s.drones.guardian, T.raidStrength(s));
  });

  protected ago(at: number): string {
    return formatDuration(this.t().clock - at) + ' ago';
  }

  protected duration(sec: number): string {
    return formatDuration(sec);
  }

  protected pct(n: number): string {
    return `${Math.round(n * 100)}%`;
  }
}
