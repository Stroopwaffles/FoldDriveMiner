import { Component, computed, inject, signal } from '@angular/core';
import { ZONES, ZoneId } from '../game/config';
import { CREW } from '../game/crew-data';
import * as E from '../game/engine';
import { FRAMES, FrameId, MECH, MECH_STATS, PARTS, SLOTS, SlotId, frameDef, partDef } from '../game/fleet-data';
import { formatDuration } from '../game/format';
import { MechJob, MechState } from '../game/types';
import { AudioService } from '../services/audio.service';
import { GameService } from '../services/game.service';
import { MechPortrait } from '../ui/mech-portrait';
import { PilotPortrait } from '../ui/pilot-portrait';

/** The HANGAR tab: mech bays, loadouts with the power budget, parts shop and repairs. */
@Component({
  selector: 'fdm-hangar-panel',
  imports: [MechPortrait, PilotPortrait],
  templateUrl: './hangar-panel.html',
  styleUrl: './hangar-panel.scss',
})
export class HangarPanel {
  protected readonly game = inject(GameService);
  private readonly audio = inject(AudioService);
  protected readonly s = computed(() => this.game.state()!);

  protected readonly frames = FRAMES;
  protected readonly slots = SLOTS;
  protected readonly mechStatDefs = MECH_STATS;
  protected readonly bays = computed(() => E.hangarBays(this.s()));
  protected readonly hasRepair = computed(() => E.hasResearch(this.s(), 'repair_bay'));
  protected readonly hasAutoRepair = computed(() => E.hasResearch(this.s(), 'auto_repair'));
  protected readonly repairCost = E.repairCostPerPoint();

  protected readonly selectedId = signal<number | null>(null);
  protected readonly shopSlot = signal<SlotId>('drill');

  protected readonly cards = computed(() => {
    const s = this.s();
    const cards = s.mechs.map((m) => this.view(m));
    return { cards, empty: Math.max(0, this.bays() - s.mechs.length) };
  });

  protected readonly selected = computed(() => {
    const s = this.s();
    const id = this.selectedId() ?? s.mechs[0]?.id ?? null;
    const m = s.mechs.find((x) => x.id === id);
    return m ? this.view(m) : null;
  });

  private view(m: MechState) {
    const s = this.s();
    const stats = E.mechStats(s, m);
    const cond = E.mechCondition(s, m);
    const pilot = E.pilotById(s, m.pilotId);
    const rate = E.mechOreRate(s, m);
    const total = Object.values(rate).reduce((a, b) => a + b, 0);
    return {
      mech: m,
      frame: frameDef(m.frame),
      stats,
      cond,
      pilot,
      flying: E.mechPilot(s, m),
      sync: pilot ? E.syncLevel(pilot, m.frame) : 0,
      syncNext: pilot ? CREW.syncThresholds[E.syncLevel(pilot, m.frame)] ?? null : null,
      syncSec: pilot ? pilot.sync[m.frame] : 0,
      orePerSec: total,
      link: m.job === 'mining' && E.mechOperable(s, m) ? E.commandLink(s, m.zone) : 0,
      sdPerSec: E.mechSdRate(s, m),
      pilotMult: E.pilotMultiplier(s, m),
      technique: E.techniqueName(s, m),
      techniqueReady: E.techniqueReady(s, m),
      boosting: m.boostRemaining > 0,
      zoneName: ZONES.find((z) => z.id === m.zone)!.name,
      parts: SLOTS.map((slot) => ({
        slot,
        part: m.parts[slot.id] ? partDef(m.parts[slot.id]!) : null,
        owned: PARTS.filter((p) => p.slot === slot.id && (s.parts[p.id] ?? 0) > 0),
      })),
    };
  }

  protected readonly zones = computed(() => E.unlockedZones(this.s()));
  protected readonly seatOptions = computed(() => {
    const s = this.s();
    return s.pilots.map((p) => {
      const mech = E.pilotMech(s, p);
      const post = E.pilotPost(s, p);
      const where = mech ? `in ${mech.designation}` : post ? 'on station post' : 'available';
      return { p, label: `${p.name} "${p.callsign}" · Lv ${p.level} · ${where}${E.isInjured(p) ? ' · INJURED' : ''}`, injured: E.isInjured(p) };
    });
  });

  protected readonly shop = computed(() => {
    const s = this.s();
    return PARTS.filter((p) => p.slot === this.shopSlot()).map((p) => ({
      part: p,
      owned: s.parts[p.id] ?? 0,
      locked: !!p.research && !E.hasResearch(s, p.research),
      lockName: p.research ? 'Mech Engineering' : '',
    }));
  });

  /** Power the selected mech would use if this part replaced the current one. */
  protected previewPower(slot: SlotId, partId: string | null): { draw: number; supply: number; over: boolean } | null {
    const v = this.selected();
    if (!v) return null;
    const parts = { ...v.mech.parts };
    if (partId) parts[slot] = partId;
    else delete parts[slot];
    const st = E.mechStats(this.s(), v.mech, parts);
    return { draw: st.draw, supply: st.supply, over: st.overloaded };
  }

  protected select(id: number): void {
    this.audio.blip();
    this.selectedId.set(id);
  }

  protected setJob(id: number, job: MechJob): void {
    this.game.setMechJob(id, job);
  }

  protected setZone(id: number, e: Event): void {
    this.game.setMechZone(id, (e.target as HTMLSelectElement).value as ZoneId);
  }

  protected seat(id: number, e: Event): void {
    const v = (e.target as HTMLSelectElement).value;
    this.game.seatPilot(id, v === '' ? null : Number(v));
  }

  protected equip(mechId: number, slot: SlotId, e: Event): void {
    const v = (e.target as HTMLSelectElement).value;
    this.game.equipPart(mechId, slot, v === '' ? null : v);
  }

  protected build(frame: FrameId): void {
    this.game.buildMech(frame);
    const s = this.s();
    this.selectedId.set(s.mechs[s.mechs.length - 1]?.id ?? null);
  }

  protected statLabel(id: string): string {
    return id.toUpperCase().slice(0, 3);
  }

  protected partStats(stats: Record<string, number | undefined>): string {
    return Object.entries(stats)
      .filter(([, v]) => v)
      .map(([k, v]) => `${v! > 0 ? '+' : ''}${v} ${k.slice(0, 3).toUpperCase()}`)
      .join(' · ');
  }

  protected duration(sec: number): string {
    return formatDuration(sec);
  }

  protected readonly MECH = MECH;
  protected readonly Math = Math;
  protected readonly emptyBays = computed(() => Array.from({ length: this.cards().empty }, (_, i) => i));
}
