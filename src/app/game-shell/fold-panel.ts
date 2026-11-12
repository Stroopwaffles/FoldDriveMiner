import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ORES } from '../game/config';
import { CORE_UPGRADES, FOLD } from '../game/fold-data';
import * as F from '../game/fold-rules';
import { formatDuration } from '../game/format';
import { researchNode } from '../game/research';
import * as S from '../game/sector-rules';
import { GameService } from '../services/game.service';
import { SettingsService } from '../services/settings.service';

/** The FOLD tab: charge the drive, pick a destination, archive research, spend Resonance and jump. */
@Component({
  selector: 'fdm-fold-panel',
  templateUrl: './fold-panel.html',
  styleUrl: './fold-panel.scss',
})
export class FoldPanel {
  protected readonly game = inject(GameService);
  private readonly settings = inject(SettingsService);
  protected readonly s = computed(() => this.game.state()!);

  protected readonly online = computed(() => F.driveOnline(this.s()));
  protected readonly cap = computed(() => F.chargeCap(this.s()));
  protected readonly charge = computed(() => this.s().fold.charge);
  /** Gauge segments: 10 per 100%, plus over-charge segments. */
  protected readonly segments = computed(() => {
    const n = Math.round(this.cap() * 10);
    const c = this.charge();
    return Array.from({ length: n }, (_, i) => ({ on: c >= (i + 1) / 10 - 1e-9, over: i >= 10, part: c > i / 10 && c < (i + 1) / 10 ? (c - i / 10) * 10 : 0 }));
  });
  protected readonly needed = computed(() => F.chargeNeeded(this.s()) / F.chargeEfficiency(this.s()));
  protected readonly fuel = computed(() => {
    const s = this.s();
    return ORES.filter((o) => o.id === 'helium3' || o.id === 'voidglass').map((o) => ({
      ore: o,
      held: s.cargo[o.id],
      ingots: Math.floor(s.ingots[o.id]),
      units: F.fuelUnits(s, o.id, false),
      ingotUnits: F.fuelUnits(s, o.id, true),
    }));
  });
  /** Nullsteel bars on hand and what each is worth as fuel. */
  protected readonly nullsteel = computed(() => ({ held: Math.floor(this.s().alloys?.nullsteel ?? 0), units: F.nullsteelFuelUnits() }));
  protected readonly cellShare = Math.round(FOLD.cellCharge * 100);
  protected readonly gain = computed(() => F.resonanceGain(this.s()));
  protected readonly runCredits = computed(() => F.runCredits(this.s()));
  protected readonly mult = computed(() => F.resonanceMult(this.s()));
  protected readonly blocker = computed(() => F.canJump(this.s()));

  protected readonly destinations = computed(() =>
    S.destinationPreview(this.s(), F.destinationCount(this.s()), F.revealedTraits(this.s())).map(({ def, revealed }, i) => ({
      i,
      def,
      star: S.mainStar(def),
      starLabel: S.starLabel(def),
      profile: S.profileDef(def.profile),
      traits: def.traits.map((t, k) => (k < revealed ? S.sectorTraitDef(t) : null)),
      zones: def.zones.length,
    })),
  );

  protected readonly archive = computed(() => {
    const s = this.s();
    return {
      slots: F.archiveSlots(s),
      chosen: s.fold.archive,
      options: F.archivable(s).map((id) => ({ id, name: researchNode(id).name, level: s.research.levels[id] })),
      permanent: F.permanentNodes(s).map((id) => researchNode(id).name),
    };
  });

  protected readonly core = computed(() =>
    CORE_UPGRADES.map((def) => ({ def, level: F.coreLevel(this.s(), def.id), cost: F.coreCost(this.s(), def.id) })),
  );


  /** Deep Fold: only after Master the Cycle. */
  protected readonly deep = computed(() => {
    const s = this.s();
    if (s.story.choice !== 'master') return null;
    return {
      blocker: F.canDeepFold(s),
      gain: F.deepFoldGain(s),
      echoes: s.fold.echoes ?? 0,
      folds: s.fold.deepFolds ?? 0,
      minDepth: FOLD.deepMinDepth,
      resonanceBonus: Math.round(FOLD.echoResonance * 100),
      productionBonus: Math.round(FOLD.echoProduction * 100),
    };
  });
  protected readonly deepConfirming = signal(false);

  protected deepFold(): void {
    if (this.settings.settings().confirmJump && !this.deepConfirming()) {
      this.deepConfirming.set(true);
      setTimeout(() => this.deepConfirming.set(false), 5000);
      return;
    }
    this.deepConfirming.set(false);
    this.game.startJump(true);
  }

  // Two-step confirm for the jump button.
  protected readonly confirming = signal(false);
  private confirmTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.confirmTimer) clearTimeout(this.confirmTimer);
    });
  }

  protected jump(): void {
    if (!this.settings.settings().confirmJump) {
      this.game.startJump();
      return;
    }
    if (!this.confirming()) {
      this.confirming.set(true);
      this.confirmTimer = setTimeout(() => this.confirming.set(false), 5000);
      return;
    }
    this.confirming.set(false);
    this.game.startJump();
  }

  protected pct(n: number): string {
    return `${Math.round(n * 100)}%`;
  }

  protected duration(sec: number): string {
    return formatDuration(sec);
  }
}
