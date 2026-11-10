import { Component, computed, inject } from '@angular/core';
import { oreDef } from '../game/config';
import { formatDuration } from '../game/format';
import { CONTRACT, CORPS, ITEM_INFO, OUTFITS, REP_TIERS, STANDING, clanDef } from '../game/trade-data';
import * as TR from '../game/trade-rules';
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
  protected readonly fleet = computed(() => {
    const f = this.s().trade.fleet;
    if (!f) return null;
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
  });

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

  protected readonly locals = computed(() =>
    this.s().contracts.local.map((o) => ({ o, label: OUTFITS[o.archetype].label, legacy: OUTFITS[o.archetype].legacy })),
  );

  protected oreName(id: string | undefined): string {
    return id ? oreDef(id as never).name : '';
  }

  protected duration(sec: number): string {
    return formatDuration(sec);
  }
}
