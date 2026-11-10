import { Component, computed, inject } from '@angular/core';
import { ANOMALIES, BEACON_LORE, CODEX_SETS, RARITY_COLOR } from '../game/anomaly-data';
import { GameService } from '../services/game.service';

/** MAP › CODEX: every anomaly type found, set bonuses, and the Silent Beacon's lore. */
@Component({
  selector: 'fdm-codex-panel',
  template: `
    @let st = s();
    <div class="codex">
      <div class="sets">
        @for (set of sets(); track set.id) {
          <div class="set" [class.done]="set.done">
            <div class="set-name">{{ set.name }} <span class="dim">{{ set.found }}/{{ set.total }}</span></div>
            <div class="small" [class.ok]="set.done" [class.dim]="!set.done">{{ set.done ? 'COMPLETE — ' : 'Complete for: ' }}{{ set.bonus }}</div>
          </div>
        }
      </div>

      <div class="entries">
        @for (e of entries(); track e.def.kind) {
          <div class="entry" [class.unknown]="!e.count" [style.--rc]="e.color">
            <div class="e-head">
              <span class="e-name">{{ e.count ? e.def.name : '???' }}</span>
              <span class="kana">{{ e.count ? e.def.kana : '' }}</span>
              <span class="rarity">{{ e.def.rarity.toUpperCase() }}</span>
              @if (e.count) {
                <span class="dim small">×{{ e.count }}</span>
              }
            </div>
            <div class="e-text">{{ e.count ? e.def.codex : 'Not yet encountered.' }}</div>
          </div>
        }
      </div>

      <div class="lore">
        <div class="sub">SILENT BEACON — DECODED FRAGMENTS <span class="kana">ちんもくのビーコン</span></div>
        @for (line of lore(); track $index; let i = $index) {
          <div class="frag"><b>#{{ i + 1 }}</b> {{ line }}</div>
        } @empty {
          <div class="dim small">No fragments decoded. Find and scan the Silent Beacon, then begin decoding.</div>
        }
        @if (lore().length && lore().length < 5) {
          <div class="frag locked">#{{ lore().length + 1 }} ▒▒▒▒▒▒▒▒ ▒▒▒▒ ▒▒▒▒▒▒▒</div>
        }
      </div>
    </div>
  `,
  styles: `
    .codex {
      padding: 0.8rem 0.9rem 0.9rem;
      display: grid;
      gap: 0.8rem;
    }
    .dim {
      color: var(--text-dim);
    }
    .small {
      font-size: 0.72rem;
    }
    .ok {
      color: var(--ok);
    }
    .sub {
      font-family: var(--font-display);
      font-size: 0.64rem;
      letter-spacing: 0.18em;
      color: var(--amber);
      margin-bottom: 0.4rem;
    }
    .kana {
      font-family: var(--font-kana);
      color: var(--text-dim);
      font-size: 0.62rem;
    }
    .sets {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 6px;
    }
    .set {
      padding: 0.45rem 0.6rem;
      border: 1px dashed #2a3168;
      &.done {
        border: 1px solid var(--ok);
        background: rgba(109, 255, 155, 0.06);
      }
    }
    .set-name {
      font-family: var(--font-display);
      font-size: 0.75rem;
    }
    .entries {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 6px;
    }
    .entry {
      border: 1px solid #232a5c;
      border-left: 3px solid var(--rc);
      padding: 0.45rem 0.6rem;
      background: rgba(10, 13, 34, 0.6);
      display: grid;
      gap: 0.25rem;
      &.unknown {
        opacity: 0.5;
      }
    }
    .e-head {
      display: flex;
      gap: 0.4rem;
      align-items: baseline;
      flex-wrap: wrap;
    }
    .e-name {
      font-family: var(--font-display);
      color: var(--rc);
      font-size: 0.8rem;
    }
    .rarity {
      margin-left: auto;
      font-size: 0.56rem;
      letter-spacing: 0.15em;
      color: var(--rc);
    }
    .e-text {
      font-size: 0.74rem;
      font-style: italic;
      color: var(--text);
    }
    .lore {
      border: 1px solid var(--amber-dim);
      background: repeating-linear-gradient(0deg, rgba(255, 181, 71, 0.03) 0 1px, transparent 1px 3px), #0a0a10;
      padding: 0.6rem 0.75rem;
    }
    .frag {
      font-family: var(--font-mono);
      color: var(--amber);
      font-size: 0.8rem;
      text-shadow: 0 0 6px rgba(255, 181, 71, 0.4);
      margin-bottom: 0.3rem;
      b {
        color: var(--text-dim);
        font-weight: normal;
      }
      &.locked {
        color: var(--text-dim);
        text-shadow: none;
      }
    }
  `,
})
export class CodexPanel {
  protected readonly game = inject(GameService);
  protected readonly s = computed(() => this.game.state()!);

  protected readonly entries = computed(() => {
    const codex = this.s().anomalies.codex;
    return ANOMALIES.map((def) => ({ def, count: codex[def.kind] ?? 0, color: RARITY_COLOR[def.rarity] }));
  });

  protected readonly sets = computed(() => {
    const codex = this.s().anomalies.codex;
    return CODEX_SETS.map((set) => {
      const found = set.kinds.filter((k) => (codex[k] ?? 0) > 0).length;
      return { ...set, found, total: set.kinds.length, done: found === set.kinds.length };
    });
  });

  protected readonly lore = computed(() => {
    const s = this.s();
    return BEACON_LORE.slice(0, s.anomalies.lore).map((l) => l.replaceAll('{ship}', s.ship.toUpperCase()));
  });
}
