import { Component, computed, inject } from '@angular/core';
import { ANOMALIES, BEACON_LORE, CODEX_SETS, RARITY_COLOR } from '../game/anomaly-data';
import { CURIOS } from '../game/curio-data';
import { GameService } from '../services/game.service';
import { CurioArt } from '../ui/curio-art';

/** MAP › CODEX: every anomaly type found, set bonuses, the Silent Beacon's lore and curios. */
@Component({
  selector: 'fdm-codex-panel',
  imports: [CurioArt],
  template: `
    <div class="codex">
      <div class="howto">
        <b>SET BONUSES</b> switch on by themselves once you've <b>identified</b> every anomaly in a set at least once.
        Identify an anomaly by scanning its signal in <b>SIGNALS</b>. Passing anomalies leave after a while, so scan them quickly.
        Set bonuses are permanent and stay through every Fold Jump.
      </div>
      <div class="sets">
        @for (set of sets(); track set.id) {
          <div class="set" [class.done]="set.done">
            <div class="set-name">{{ set.name }} <span class="dim">{{ set.found }}/{{ set.total }}</span></div>
            <div class="small" [class.ok]="set.done" [class.dim]="!set.done">{{ set.done ? 'ACTIVE: ' : 'Bonus when complete: ' }}{{ set.bonus }}</div>
            <div class="members">
              @for (m of set.members; track m.kind) {
                <div class="member" [class.found]="m.found" [style.--rc]="m.color">
                  <span class="tick">{{ m.found ? '✓' : '○' }}</span>
                  <span class="m-name">{{ m.found ? m.name : '???' }}</span>
                  <span class="m-hint">{{ m.hint }}</span>
                </div>
              }
            </div>
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

      <div class="curios">
        <div class="sub">CURIOS <span class="kana">きぶつ</span> <span class="dim count">{{ curioCount() }}/{{ curios().length }}</span></div>
        <div class="dim small">Relics sold by Grey Tithe and Starward Collegium traders. Each one you buy is identified here. Curios stay with you through every Fold Jump.</div>
        <div class="curio-grid">
          @for (c of curios(); track c.def.id) {
            <div class="curio" [class.unknown]="!c.found">
              <fdm-curio-art [id]="c.def.id" [found]="c.found" [size]="64" />
              <div>
                <div class="c-name">{{ c.found ? c.def.name : '???' }}</div>
                <div class="c-note">{{ c.found ? c.note : 'Not yet found. Look for curios in trader convoys.' }}</div>
              </div>
            </div>
          }
        </div>
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
    .howto {
      font-size: 0.74rem;
      color: var(--text-dim);
      border-left: 2px solid var(--cyan);
      padding: 0.3rem 0.6rem;
      background: rgba(79, 227, 255, 0.05);
      b {
        color: var(--cyan);
        font-weight: normal;
      }
    }
    .members {
      margin-top: 0.35rem;
      display: grid;
      gap: 2px;
    }
    .member {
      display: flex;
      gap: 0.4rem;
      align-items: baseline;
      font-size: 0.7rem;
      color: var(--text-dim);
      .tick {
        width: 0.8rem;
      }
      &.found {
        color: var(--text);
        .tick {
          color: var(--ok);
        }
      }
      .m-name {
        color: var(--rc);
      }
      .m-hint {
        margin-left: auto;
        font-size: 0.62rem;
        text-align: right;
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
    .curios {
      border: 1px solid #2a3168;
      padding: 0.6rem 0.75rem;
      background: rgba(10, 13, 34, 0.6);
    }
    .count {
      margin-left: 0.5rem;
    }
    .curio-grid {
      margin-top: 0.5rem;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 6px;
    }
    .curio {
      display: grid;
      grid-template-columns: 64px 1fr;
      gap: 0.6rem;
      align-items: start;
      padding: 0.45rem;
      border: 1px solid #232a5c;
      border-left: 3px solid #c77dff;
      &.unknown {
        opacity: 0.5;
        border-left-color: #3a4178;
      }
    }
    .c-name {
      font-family: var(--font-display);
      font-size: 0.78rem;
      color: #c77dff;
    }
    .c-note {
      margin-top: 0.2rem;
      font-size: 0.72rem;
      font-style: italic;
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
      const depth = this.s().sector.depth;
      const members = set.kinds.map((k) => {
        const def = ANOMALIES.find((a) => a.kind === k)!;
        const found = (codex[k] ?? 0) > 0;
        const where = def.fixed ? 'stays put' : 'passing';
        const hint = found ? '' : depth < def.minDepth ? `${def.rarity} · from depth ${def.minDepth}` : `${def.rarity} · ${where}`;
        return { kind: k, name: def.name, found, hint, color: RARITY_COLOR[def.rarity] };
      });
      const found = members.filter((m) => m.found).length;
      return { ...set, members, found, total: set.kinds.length, done: found === set.kinds.length };
    });
  });

  protected readonly curios = computed(() => {
    const s = this.s();
    const have = new Set(s.anomalies.curios ?? []);
    return CURIOS.map((def) => ({ def, found: have.has(def.id), note: def.note.replaceAll('{ship}', s.ship) }));
  });
  protected readonly curioCount = computed(() => this.curios().filter((c) => c.found).length);

  protected readonly lore = computed(() => {
    const s = this.s();
    return BEACON_LORE.slice(0, s.anomalies.lore).map((l) => l.replaceAll('{ship}', s.ship.toUpperCase()));
  });
}
