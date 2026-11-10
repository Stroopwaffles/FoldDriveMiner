import { Component, computed, inject } from '@angular/core';
import { eventDef } from '../game/threat-data';
import * as T from '../game/threat-rules';
import { GameService } from '../services/game.service';

/**
 * Hazard-striped WARNING banner for incoming threats (with response buttons),
 * plus small chips for hazards and market events in effect.
 */
@Component({
  selector: 'fdm-threat-banner',
  template: `
    @for (w of warnings(); track w.ev.id) {
      <div class="warning" role="alert">
        <div class="stripes" aria-hidden="true"></div>
        <div class="body">
          <div class="title">
            <span class="w">WARNING</span>
            <span class="name">{{ w.def.name }}{{ w.ev.jackal ? ' — THE VERMILION JACKAL' : '' }}</span>
            <span class="kana">{{ w.def.kana }}</span>
            <span class="count">{{ w.ev.remaining.toFixed(0) }}s</span>
          </div>
          <div class="desc">{{ w.def.desc }}</div>
          <div class="actions">
            @switch (w.ev.kind) {
              @case ('raid') {
                <span class="info">Enemy strength {{ game.fmt(w.ev.strength ?? 0) }} · your defense {{ game.fmt(defense()) }}</span>
                <button type="button" class="btn btn-primary small" (click)="game.openSortiePrep(w.ev.id)">Prepare sortie</button>
                <button type="button" class="btn small" (click)="game.surrender(w.ev.id)">Surrender cargo</button>
                <span class="order">Standing order: {{ raidOrderText() }}</span>
              }
              @case ('flare') {
                <button type="button" class="btn small" [class.on]="(w.ev.response ?? orders().flare) === 'shelter'" (click)="game.respond(w.ev.id, 'shelter')">Shelter drones</button>
                <button type="button" class="btn small" [class.on]="(w.ev.response ?? orders().flare) === 'ride'" (click)="game.respond(w.ev.id, 'ride')">Ride it out</button>
              }
              @case ('rogue') {
                <span class="info">Click the red asteroid in the viewport to crack it!</span>
                <div class="hp"><div [style.width.%]="((w.ev.rogueHp ?? 0) / (w.ev.rogueMax ?? 1)) * 100"></div></div>
                <span class="order">If it reaches you: {{ orders().rogue === 'intercept' ? 'a mech intercepts' : 'impact' }}</span>
              }
            }
          </div>
        </div>
      </div>
    }
    @if (chips().length) {
      <div class="chips">
        @for (c of chips(); track c.id) {
          <span class="chip" [class.good]="c.good">{{ c.text }} · {{ c.left }}s</span>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .warning {
      position: relative;
      border: 2px solid var(--danger);
      background: #1a0508;
      overflow: hidden;
      margin-bottom: 6px;
      animation: flash 1s steps(2) infinite;
    }
    .stripes {
      height: 8px;
      background: repeating-linear-gradient(-45deg, var(--warn) 0 10px, #05060f 10px 20px);
      animation: slide 1s linear infinite;
    }
    .body {
      padding: 0.45rem 0.8rem 0.55rem;
      display: grid;
      gap: 0.3rem;
    }
    .title {
      display: flex;
      align-items: baseline;
      gap: 0.6rem;
      flex-wrap: wrap;
    }
    .w {
      font-family: var(--font-logo);
      font-style: italic;
      color: var(--danger);
      font-size: 1.2rem;
      letter-spacing: 0.15em;
      text-shadow: 0 0 10px var(--danger);
    }
    .name {
      font-family: var(--font-display);
      color: var(--text);
      letter-spacing: 0.08em;
    }
    .kana {
      font-family: var(--font-kana);
      color: var(--warn);
      font-size: 0.75rem;
    }
    .count {
      margin-left: auto;
      font-family: var(--font-display);
      color: var(--warn);
      font-size: 1.1rem;
    }
    .desc {
      font-size: 0.75rem;
      color: var(--text-dim);
    }
    .actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
      font-size: 0.72rem;
    }
    .btn.small {
      font-size: 0.66rem;
      padding: 0.25rem 0.6rem;
    }
    .btn.on {
      border-color: var(--ok);
      color: var(--ok);
    }
    .info {
      color: var(--cyan);
    }
    .order {
      color: var(--text-dim);
      margin-left: auto;
    }
    .hp {
      width: 160px;
      height: 8px;
      border: 1px solid var(--danger);
      background: #0a0d22;
      div {
        height: 100%;
        background: var(--danger);
        transition: width 0.1s;
      }
    }
    .chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 6px;
    }
    .chip {
      font-size: 0.68rem;
      letter-spacing: 0.06em;
      padding: 0.15rem 0.5rem;
      border: 1px solid var(--orange);
      color: var(--orange);
      background: rgba(255, 122, 61, 0.08);
      &.good {
        border-color: var(--ok);
        color: var(--ok);
        background: rgba(109, 255, 155, 0.08);
      }
    }
    @keyframes flash {
      50% {
        border-color: var(--warn);
      }
    }
    @keyframes slide {
      to {
        background-position: 28px 0;
      }
    }
  `,
})
export class ThreatBanner {
  protected readonly game = inject(GameService);
  private readonly s = computed(() => this.game.state()!);

  protected readonly orders = computed(() => this.s().threats.orders);

  protected readonly warnings = computed(() =>
    this.s()
      .threats.events.filter((e) => e.phase === 'warning')
      .map((ev) => ({ ev, def: eventDef(ev.kind) })),
  );

  protected readonly defense = computed(() => {
    const s = this.s();
    return T.defensePower(s, T.defenders(s, s.threats.orders.raid === 'defend_all'), true);
  });

  protected readonly chips = computed(() =>
    this.s()
      .threats.events.filter((e) => e.phase === 'active')
      .map((e) => {
        const left = Math.max(0, Math.ceil(e.remaining));
        switch (e.kind) {
          case 'flare':
            return { id: e.id, left, good: false, text: e.response === 'ride' ? 'SOLAR FLARE — drones exposed' : 'SOLAR FLARE — drones sheltered, mining paused' };
          case 'micrometeor':
            return { id: e.id, left, good: false, text: 'MICROMETEOR STORM — drones taking hits' };
          case 'reactor':
            return { id: e.id, left, good: false, text: 'REACTOR FAULT — output 70%' };
          case 'blackout':
            return { id: e.id, left, good: false, text: 'COMMS BLACKOUT — market offline' };
          case 'boom':
            return { id: e.id, left, good: true, text: `ORE BOOM — ${e.ore ? T.oreName(e.ore) : ''} ×2 price` };
          default:
            return { id: e.id, left, good: false, text: `MARKET CRASH — ${e.ore ? T.oreName(e.ore) : ''} ×0.5 price` };
        }
      }),
  );

  protected raidOrderText(): string {
    const o = this.orders().raid;
    return o === 'defend' ? 'defend with standby mechs + Guardians' : o === 'defend_all' ? 'scramble every mech + Guardians' : 'surrender cargo';
  }
}
