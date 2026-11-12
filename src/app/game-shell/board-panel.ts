import { Component, computed, inject } from '@angular/core';
import { OreId, oreDef } from '../game/config';
import { AlloyId, alloyDef } from '../game/alloy-data';
import { improvementDef } from '../game/improvement-data';
import { formatDuration } from '../game/format';
import { CONTRACT, CORPS, ITEM_INFO, OUTFITS, REP_TIERS, STANDING, clanDef } from '../game/trade-data';
import * as TR from '../game/trade-rules';
import * as IR from '../game/improvement-rules';
import { Contract } from '../game/types';
import { GameService } from '../services/game.service';

/** The BOARD tab: the merchant convoy in the sector, the contract board, corporate and local standing. */
@Component({
  selector: 'fdm-board-panel',
  templateUrl: './board-panel.html',
  styleUrl: './board-panel.scss',
})
export class BoardPanel {
  protected readonly game = inject(GameService);
  protected readonly s = computed(() => this.game.state()!);
  protected readonly itemInfo = ITEM_INFO;
  protected readonly legacyAt = CONTRACT.localLegacy;
  protected readonly rerollCost = CONTRACT.rerollCost;

  // ---------------------------------------------------------------- convoy
  protected readonly fleets = computed(() =>
    this.s().trade.fleets.map((f) => {
    const clan = clanDef(f.clan);
    const rep = this.s().trade.rep[f.clan];
    const tier = TR.repTier(rep);
    const next = REP_TIERS.find((t) => t.min > rep);
    return {
      f,
      clan,
      rep,
      tier,
      next,
      stock: f.stock.map((item) => ({
        item,
        info: ITEM_INFO[item.kind],
        credits: TR.canBuy(this.s(), item.id, 'credits'),
        barter: item.barterOre ? TR.canBuy(this.s(), item.id, 'barter') : 'n/a',
        cores: item.dataCores ? TR.canBuy(this.s(), item.id, 'cores') : 'n/a',
      })),
      favorReady: !!f.favor && !f.favor.done && this.s().cargo[f.favor.ore] >= f.favor.amount,
    };
    }),
  );
  /** Convoy slots in this sector (3 in a Trade Nexus). */
  protected readonly maxConvoys = computed(() => TR.maxConvoys(this.s()));

  protected readonly nextConvoy = computed(() => {
    const t = this.s().trade;
    return t.pending ? 'arriving now' : `~${formatDuration(Math.max(0, t.nextIn))}`;
  });

  protected readonly inventory = computed(() => this.s().trade.inventory);

  // ---------------------------------------------------------------- contracts
  protected readonly slots = computed(() => TR.contractSlots(this.s()));
  protected readonly active = computed(() => this.s().contracts.active.map((c) => this.view(c)));
  protected readonly board = computed(() => this.s().contracts.board.map((c) => this.view(c)));

  private view(c: Contract) {
    const goal = c.type === 'sustain' ? CONTRACT.sustainSec : c.target;
    const corp = c.issuer.kind === 'corp' ? CORPS.find((x) => x.id === c.issuer.id) : null;
    const local = c.issuer.kind === 'local' ? this.s().contracts.local.find((l) => l.id === c.issuer.id) : null;
    return {
      c,
      build: this.build(c),
      frac: Math.min(1, c.progress / goal),
      color: corp?.color ?? '#6dff9b',
      issuer: corp?.name ?? local?.name ?? 'Local outfit',
      kind: corp ? 'CORPORATE' : `LOCAL · ${local ? OUTFITS[local.archetype].label.toUpperCase() : ''}`,
      progressText:
        c.type === 'sustain'
          ? `${formatDuration(c.progress)} / ${formatDuration(goal)} held`
          : `${this.game.fmt(c.progress)} / ${this.game.fmt(goal)}`,
    };
  }

  protected readonly corps = computed(() =>
    CORPS.map((def) => {
      const st = TR.corpStanding(this.s(), def.id);
      return { def, st, trusted: st >= STANDING.trusted, partner: st >= STANDING.partner, frac: Math.min(1, st / STANDING.partner) };
    }),
  );
  protected readonly standing = STANDING;
  protected readonly Math = Math;

  protected readonly locals = computed(() =>
    this.s().contracts.local.map((o) => ({ o, label: OUTFITS[o.archetype].label, legacy: OUTFITS[o.archetype].legacy })),
  );

  /** Construction contracts: what they build, and the materials (have / need). */
  private build(c: Contract) {
    if (c.type !== 'construction' || !c.improvement) return null;
    const s = this.s();
    const cost = IR.buildCost(s, c);
    const mats = [
      ...Object.entries(cost.ingots).map(([o, n]) => ({ name: `${oreDef(o as never).name} ingots`, need: n!, have: Math.floor(s.ingots[o as OreId]) })),
      ...Object.entries(cost.alloys).map(([a, n]) => ({ name: alloyDef(a as AlloyId).name, need: n!, have: Math.floor(s.alloys[a as AlloyId] ?? 0) })),
    ];
    return { def: improvementDef(c.improvement), mats, blocker: IR.buildBlocker(s, c), needsAlloys: Object.keys(cost.alloys).length > 0 };
  }

  /** Improvements standing in this sector. */
  protected readonly improvements = computed(() => IR.builtHere(this.s()).map((id) => improvementDef(id)));

  protected oreName(id: string | undefined): string {
    return id ? oreDef(id as never).name : '';
  }

  protected duration(sec: number): string {
    return formatDuration(sec);
  }
}
