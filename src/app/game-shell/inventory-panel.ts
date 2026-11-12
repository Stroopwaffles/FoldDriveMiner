import { Component, computed, inject } from '@angular/core';
import { ALLOYS } from '../game/alloy-data';
import { ORES } from '../game/config';
import { CORPS, MERCHANT } from '../game/trade-data';
import * as E from '../game/engine';
import * as F from '../game/fold-rules';
import { corpPerk } from '../game/trade-rules';
import { PartDef, SLOTS, partDef } from '../game/fleet-data';
import { formatDuration } from '../game/format';
import { GameService, Tab } from '../services/game.service';

const RARITY_ORDER: Record<PartDef['rarity'], number> = { legendary: 0, unique: 1, surplus: 2, standard: 3 };

/** The INVENTORY tab: everything the ship is carrying, in one place. */
@Component({
  selector: 'fdm-inventory-panel',
  templateUrl: './inventory-panel.html',
  styleUrl: './inventory-panel.scss',
})
export class InventoryPanel {
  protected readonly game = inject(GameService);
  protected readonly s = computed(() => this.game.state()!);
  protected readonly Math = Math;

  /** Credits, Survey Data, Data Cores. */
  protected readonly resources = computed(() => {
    const s = this.s();
    return [
      { name: 'Credits', value: this.game.fmt(s.credits) + ' cr', color: 'var(--amber)', note: 'Spent on upgrades, drones, mechs and parts.' },
      { name: 'Survey Data', value: this.game.fmt(s.surveyData), color: 'var(--cyan)', note: 'Research in the LAB, sector scans on the MAP.' },
      { name: 'Data Cores', value: String(s.dataCores), color: 'var(--magenta)', note: 'Rush research, Core Matrix, legendary parts.' },
    ];
  });

  /** Ore, ingots and alloys in the hold, with what they'd sell for now. */
  protected readonly hold = computed(() => {
    const s = this.s();
    const rows: { name: string; kind: string; amount: number; price: number; color: string }[] = [];
    for (const o of ORES) {
      if (s.cargo[o.id] >= 0.01) rows.push({ name: o.name, kind: 'ORE', amount: s.cargo[o.id], price: E.orePrice(s, o.id), color: o.color });
    }
    for (const o of ORES) {
      if (s.ingots[o.id] >= 0.01) rows.push({ name: `${o.name} ingot`, kind: 'INGOT', amount: s.ingots[o.id], price: E.ingotPrice(s, o.id), color: o.color });
    }
    for (const a of ALLOYS) {
      if (s.alloys[a.id] >= 0.01) rows.push({ name: a.name, kind: 'ALLOY', amount: s.alloys[a.id], price: E.alloyPrice(s, a.id), color: a.color });
    }
    return rows.map((r) => ({ ...r, value: Math.floor(r.amount) * r.price }));
  });
  protected readonly holdValue = computed(() => this.hold().reduce((sum, r) => sum + r.value, 0));
  protected readonly used = computed(() => E.cargoUsed(this.s()));
  protected readonly capacity = computed(() => E.cargoCapacity(this.s()));

  /** Consumables bought from merchants. */
  protected readonly supplies = computed(() => {
    const s = this.s();
    const inv = s.trade.inventory;
    return [
      { id: 'repair_kit', name: 'Repair kit', count: inv.repair_kit, desc: 'Instantly repairs one mech.', use: 'hangar' as Tab, useLabel: 'Use in HANGAR' },
      { id: 'medkit', name: 'Med kit', count: inv.medkit, desc: 'Instantly heals one injured pilot.', use: 'crew' as Tab, useLabel: 'Use in CREW' },
      { id: 'fold_cell', name: 'Fold charge cell', count: inv.fold_cell, desc: 'Adds charge to the Fold Drive.', use: null, useLabel: '' },
    ];
  });
  protected readonly canUseCell = computed(() => {
    const s = this.s();
    return F.driveOnline(s) && s.trade.inventory.fold_cell > 0 && s.fold.charge < F.chargeCap(s);
  });

  /** Timed effects running right now, and buys that last for this sector. */
  protected readonly effects = computed(() => {
    const s = this.s();
    const t = s.trade;
    const out: { name: string; detail: string }[] = [];
    if (t.overdriveCell > 0) out.push({ name: 'Overdrive cell', detail: `${formatDuration(t.overdriveCell)} left · every hit at Overdrive` });
    if (t.researchGrant > 0) out.push({ name: 'Research grant', detail: `${formatDuration(t.researchGrant)} left · research +${Math.round(MERCHANT.grantBonus * 100)}%` });
    if (t.deterrent > 0) out.push({ name: 'Deterrent beacon', detail: `${formatDuration(t.deterrent)} left · no raids` });
    for (const [ore, bonus] of Object.entries(t.sectorBuffs.sell)) {
      const def = ORES.find((o) => o.id === ore);
      if (def && bonus) out.push({ name: `${def.name} contract`, detail: `+${Math.round(bonus * 100)}% sell price in this sector` });
    }
    for (const trait of t.sectorBuffs.cancelled) {
      out.push({ name: 'Countermeasure', detail: `"${trait.replace(/_/g, ' ')}" cancelled in this sector` });
    }
    return out;
  });
  protected readonly cellSec = MERCHANT.overdriveCellSec;

  /** Parts in storage and fitted to mechs, grouped by slot. */
  protected readonly parts = computed(() => {
    const s = this.s();
    const fitted = new Map<string, string[]>();
    for (const m of s.mechs) {
      for (const id of Object.values(m.parts)) {
        if (!id) continue;
        fitted.set(id, [...(fitted.get(id) ?? []), m.designation]);
      }
    }
    const ids = new Set([...Object.keys(s.parts).filter((id) => s.parts[id] > 0), ...fitted.keys()]);
    const rows = [...ids].map((id) => {
      const p = partDef(id);
      return { p, stored: s.parts[id] ?? 0, fittedOn: fitted.get(id) ?? [], stats: this.partStats(p) };
    });
    return SLOTS.map((slot) => ({
      slot,
      rows: rows.filter((r) => r.p.slot === slot.id).sort((a, b) => RARITY_ORDER[a.p.rarity] - RARITY_ORDER[b.p.rarity] || a.p.name.localeCompare(b.p.name)),
    })).filter((g) => g.rows.length);
  });
  protected readonly partCount = computed(() => this.parts().reduce((n, g) => n + g.rows.reduce((k, r) => k + r.stored + r.fittedOn.length, 0), 0));

  /** Permanent fittings and perks the ship carries everywhere. */
  protected readonly equipment = computed(() => {
    const s = this.s();
    const out: { name: string; detail: string }[] = [];
    if (s.drill.clamp) out.push({ name: 'Trigger Clamp', detail: 'Hold the mouse button to keep drilling.' });
    if ((s.sensorArray ?? 0) > 0) out.push({ name: `Long-Range Sensor Array LV ${s.sensorArray}`, detail: 'Finds special asteroids more often (this sector).' });
    for (const corp of CORPS) {
      if (corpPerk(s, corp.id)) out.push({ name: `${corp.name} trust`, detail: corp.perk });
    }
    for (const perk of s.trade.perks) {
      if (perk === 'combine_overhaul') out.push({ name: 'Combine Overhaul Contract', detail: 'Wreck rebuilds cost 10%, repairs 25% faster.' });
      if (perk === 'collegium_fellowship') out.push({ name: 'Collegium Fellowship', detail: `Research +${Math.round(MERCHANT.fellowshipBonus * 100)}%, permanently.` });
    }
    return out;
  });

  protected partStats(p: PartDef): string {
    const bits = Object.entries(p.stats)
      .filter(([, v]) => v)
      .map(([k, v]) => `${(v as number) > 0 ? '+' : ''}${v} ${k.slice(0, 3).toUpperCase()}`);
    if (p.supply) bits.push(`+${p.supply} PWR`);
    else if (p.draw) bits.push(`−${p.draw} PWR`);
    return bits.join(' · ');
  }

  protected go(tab: Tab): void {
    this.game.tab.set(tab);
  }
}
