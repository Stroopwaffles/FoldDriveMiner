import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { frameDef } from '../game/fleet-data';
import * as E from '../game/engine';
import * as T from '../game/threat-rules';
import { AudioService } from '../services/audio.service';
import { GameService } from '../services/game.service';
import { MechPortrait } from '../ui/mech-portrait';
import { PilotPortrait } from '../ui/pilot-portrait';

/**
 * The sortie screen. Prep: pick the squad and see the odds. Play: the battle
 * plays out round by round on a tactical radar, then the results.
 */
@Component({
  selector: 'fdm-sortie-modal',
  imports: [MechPortrait, PilotPortrait],
  templateUrl: './sortie-modal.html',
  styleUrl: './sortie-modal.scss',
})
export class SortieModal {
  protected readonly game = inject(GameService);
  private readonly audio = inject(AudioService);
  protected readonly view = this.game.sortie;
  protected readonly s = computed(() => this.game.state()!);

  // ---------------------------------------------------------------- prep
  protected readonly selected = signal<Set<number>>(new Set());
  protected readonly useGuardians = signal(true);

  protected readonly event = computed(() => {
    const v = this.view();
    return v?.eventId !== undefined ? this.s().threats.events.find((e) => e.id === v.eventId) ?? null : null;
  });

  protected readonly strength = computed(() => {
    const v = this.view();
    if (v?.strike) return T.strikeStrength(this.s());
    return this.event()?.strength ?? T.raidStrength(this.s());
  });

  protected readonly candidates = computed(() => {
    const s = this.s();
    return s.mechs.map((m) => ({
      mech: m,
      frame: frameDef(m.frame),
      ok: T.canFight(s, m),
      power: T.mechCombatPower(s, m),
      cond: E.mechCondition(s, m),
      pilot: E.mechPilot(s, m),
    }));
  });

  /** Re-run the (simulation-based) odds on squad changes and every 2 game seconds. */
  private readonly slow = computed(() => Math.floor(this.s().threats.clock / 2));
  protected readonly odds = computed(() => {
    this.slow();
    const s = untracked(() => this.s());
    const mechs = s.mechs.filter((m) => this.selected().has(m.id) && T.canFight(s, m));
    const g = this.useGuardians() ? s.drones.guardian : 0;
    if (!mechs.length && !g) return null;
    return T.riskPreview(s, mechs, g, this.strength());
  });

  protected readonly guardianPower = computed(() => T.guardianPower(this.s()) * this.s().drones.guardian);

  // ---------------------------------------------------------------- play
  protected readonly shown = signal(0);
  protected readonly report = computed(() => this.view()?.report ?? null);
  protected readonly done = computed(() => {
    const r = this.report();
    return !!r && this.shown() >= r.rounds.length;
  });
  protected readonly enemyFrac = computed(() => {
    const r = this.report();
    if (!r) return 1;
    const i = this.shown() - 1;
    return i < 0 ? 1 : r.rounds[i].enemyHpFrac;
  });
  protected readonly radarMechs = computed(() => {
    const r = this.report();
    if (!r) return [];
    return r.mechIds.map((id, i) => ({ id, x: -60 - (i % 2) * 18, y: -30 + i * 22 }));
  });
  protected readonly radarEnemies = computed(() => {
    const r = this.report();
    if (!r) return [];
    const n = Math.min(10, r.units.reduce((s, u) => s + u.count, 0));
    const alive = Math.ceil(n * this.enemyFrac());
    return Array.from({ length: n }, (_, i) => ({ x: 50 + (i % 3) * 18, y: -50 + Math.floor(i / 3) * 24 + (i % 2) * 6, dead: i >= alive }));
  });

  protected readonly guardianDots = computed(() => Array.from({ length: Math.min(this.report()?.guardians ?? 0, 8) }, (_, i) => i));

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Default squad: everything that can fight.
    effect(() => {
      const v = this.view();
      if (v?.mode === 'prep') {
        untracked(() => {
          const s = this.s();
          this.selected.set(new Set(s.mechs.filter((m) => T.canFight(s, m)).map((m) => m.id)));
          this.useGuardians.set(true);
        });
      }
    });

    // Play rounds one at a time.
    effect(() => {
      const r = this.report();
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      untracked(() => this.shown.set(0));
      if (!r) return;
      this.timer = setInterval(() => {
        const next = this.shown() + 1;
        if (next > r.rounds.length) {
          if (this.timer) clearInterval(this.timer);
          return;
        }
        this.shown.set(next);
        const round = r.rounds[next - 1];
        this.audio.explosion();
        if (round.technique) this.playTechnique(round.technique.pilotId, round.technique.name);
      }, 2000);
    });

    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearInterval(this.timer);
    });
  }

  private playTechnique(pilotId: number, technique: string): void {
    const s = this.s();
    const p = E.pilotById(s, pilotId);
    const m = s.mechs.find((x) => x.pilotId === pilotId);
    if (!p) return;
    this.game.cutIn.set({
      pilot: p.name,
      callsign: p.callsign,
      story: p.story,
      seed: p.portraitSeed,
      technique,
      color: m ? frameDef(m.frame).color : '#ff3d9a',
    });
  }

  protected toggle(id: number): void {
    const next = new Set(this.selected());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selected.set(next);
    this.audio.blip();
  }

  protected launch(): void {
    this.game.launchSortie([...this.selected()], this.useGuardians());
  }

  protected skip(): void {
    const r = this.report();
    if (r) this.shown.set(r.rounds.length);
  }

  protected close(): void {
    this.audio.blip();
    this.game.closeSortie();
  }

  protected pct(n: number): string {
    return `${Math.round(n * 100)}%`;
  }

  protected mechName(id: number): string {
    const m = this.s().mechs.find((x) => x.id === id);
    return m ? `${m.designation} "${m.name}"` : `Mech ${id}`;
  }

  protected readonly outcomeText = computed(() => {
    const o = this.report()?.outcome;
    return o === 'victory' ? 'VICTORY' : o === 'costly' ? 'COSTLY VICTORY' : o === 'surrender' ? 'SURRENDERED' : 'DEFEAT';
  });
}
