import { Component, computed, inject, signal } from '@angular/core';
import { zoneDef } from '../game/config';
import { ANOMALY, RARITY_COLOR, anomalyDef } from '../game/anomaly-data';
import * as A from '../game/anomaly-rules';
import * as E from '../game/engine';
import { formatDuration } from '../game/format';
import { GameService } from '../services/game.service';

/** MAP › SIGNALS: detected anomalies, scanning, responses and missions in flight. */
@Component({
  selector: 'fdm-signals-panel',
  template: `
    @let st = s();
    <div class="signals">
      <div class="scanner">
        <span class="sub">SENSOR ARRAY</span>
        @if (scan(); as sc) {
          <span class="scanning">SCANNING {{ sc.name }}…</span>
          <div class="bar"><div [style.width.%]="sc.progress * 100"></div></div>
          <span class="dim small">{{ duration(sc.remaining) }}</span>
        } @else {
          <span class="dim small">Idle · scan speed ×{{ speed().toFixed(2) }} (Deep Scan research, Surveyor drones, Sensor Officer)</span>
        }
      </div>

      @for (r of rows(); track r.a.id) {
        <div class="sig" [class.unknown]="r.a.status === 'signal'" [style.--rc]="r.color">
          <div class="sig-head">
            <span class="sig-name">{{ r.a.status === 'signal' ? 'Unknown signal' : r.def.name }}</span>
            @if (r.a.status !== 'signal') {
              <span class="rarity">{{ r.def.rarity.toUpperCase() }}</span>
            }
            <span class="where">{{ r.zone }}</span>
            @if (r.expires !== null) {
              <span class="expires" [class.soon]="r.expires < 30">⏳ {{ duration(r.expires) }}</span>
            }
          </div>
          <div class="sig-desc">{{ r.a.status === 'signal' ? 'Something is out there. Scan it to find out what.' : r.def.desc }}</div>

          @switch (r.a.status) {
            @case ('signal') {
              @if (r.a.kind === 'golden_asteroid') {
                <div class="hint">It's in the viewport — click it!</div>
              } @else {
                <button type="button" class="btn small" [disabled]="!!st.anomalies.scan" (click)="game.scanAnomaly(r.a.id)">
                  Scan · {{ duration(r.scanSec) }}
                </button>
              }
            }
            @case ('scanned') {
              @switch (r.a.kind) {
                @case ('gravity_lens') {
                  <div class="ok small">Mapped: drill clicks in the {{ r.zone }} hit ×2.</div>
                }
                @case ('silent_beacon') {
                  <button type="button" class="btn btn-primary small" (click)="game.startDecode(r.a.id)">Begin decoding</button>
                }
                @case ('crystal_bloom') {
                  <button type="button" class="btn btn-primary small" [disabled]="st.credits < rigCost" (click)="game.deployRig(r.a.id)">Deploy harvest rig · {{ game.fmt(rigCost) }} cr</button>
                }
                @default {
                  @if (r.mission) {
                    <div class="mission">
                      <span>{{ r.mission.approach === 'mech' ? mechName(r.mission.mechId) : r.mission.drones + ' drones' }} on site — {{ (r.mission.chance * 100).toFixed(0) }}% success</span>
                      <div class="bar"><div [style.width.%]="(1 - r.mission.remaining / r.mission.duration) * 100"></div></div>
                    </div>
                  } @else {
                    <div class="respond">
                      @if (r.def.approaches.includes('drones')) {
                        <button type="button" class="btn small" [disabled]="!!blocker(r.a.id, 'drones')" [title]="blocker(r.a.id, 'drones') ?? ''" (click)="game.launchMission(r.a.id, 'drones')">
                          Send {{ dronesFor(r.a.kind) }} drones · {{ pct(chance(r.a.kind, 'drones')) }}
                        </button>
                      }
                      @if (r.def.approaches.includes('mech')) {
                        <select (change)="pick(r.a.id, $event)" [attr.aria-label]="'Mech for ' + r.def.name">
                          <option value="">Choose a mech…</option>
                          @for (m of ready(); track m.id) {
                            <option [value]="m.id" [selected]="picked()[r.a.id] === m.id">{{ m.designation }} "{{ m.name }}" · {{ pct(chance(r.a.kind, 'mech', m.id)) }}</option>
                          }
                        </select>
                        <button type="button" class="btn btn-amber small" [disabled]="!!blocker(r.a.id, 'mech', picked()[r.a.id])" (click)="game.launchMission(r.a.id, 'mech', picked()[r.a.id])">
                          Dispatch mech
                        </button>
                      }
                    </div>
                    @if (r.a.kind === 'derelict') {
                      <div class="dim small">Salvage runs: {{ r.a.progress }}/{{ cycles }}. Mechs work twice as fast and find more.</div>
                    }
                    @if (r.a.kind === 'frozen_battlefield') {
                      <div class="dim small">Expeditions: {{ r.a.progress }}/{{ runs }}. Mech only — dangerous ground.</div>
                    }
                  }
                }
              }
            }
            @case ('active') {
              @switch (r.a.kind) {
                @case ('silent_beacon') {
                  <div class="mission">
                    <span>Decoding fragment {{ r.a.progress + 1 }}/{{ fragments }} · speed ×{{ decode().toFixed(2) }}</span>
                    <div class="bar"><div [style.width.%]="(r.a.timer / fragSec) * 100"></div></div>
                  </div>
                }
                @case ('crystal_bloom') {
                  <div class="ok small">Harvest rig running: +{{ bloom * 60 }} Voidglass per minute.</div>
                }
                @case ('comet') {
                  <div class="ok small">☄ Comet in the {{ r.zone }}: ×2 production for {{ duration(r.a.timer) }}.</div>
                }
                @default {
                  @if (r.mission) {
                    <div class="mission">
                      <span>{{ r.mission.approach === 'mech' ? mechName(r.mission.mechId) : r.mission.drones + ' drones' }} on site — {{ (r.mission.chance * 100).toFixed(0) }}% success</span>
                      <div class="bar"><div [style.width.%]="(1 - r.mission.remaining / r.mission.duration) * 100"></div></div>
                    </div>
                  }
                }
              }
            }
          }
        </div>
      } @empty {
        <p class="dim">No signals. Survey new zones to find fixed anomalies; passing ones appear every few minutes.</p>
      }
    </div>
  `,
  styles: `
    .signals {
      padding: 0.8rem 0.9rem 0.9rem;
      display: grid;
      gap: 6px;
    }
    .sub {
      font-family: var(--font-display);
      font-size: 0.64rem;
      letter-spacing: 0.18em;
      color: var(--amber);
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
    .scanner {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      align-items: center;
      padding: 0.45rem 0.6rem;
      border: 1px solid var(--cyan-dim);
      background: rgba(79, 227, 255, 0.05);
    }
    .scanning {
      color: var(--cyan);
      font-size: 0.75rem;
      animation: blink 0.9s steps(2) infinite;
    }
    @keyframes blink {
      50% {
        opacity: 0.4;
      }
    }
    .bar {
      flex: 1;
      min-width: 120px;
      height: 6px;
      background: #0a0d22;
      border: 1px solid var(--bezel);
      div {
        height: 100%;
        background: var(--cyan);
        transition: width 0.1s linear;
      }
    }
    .sig {
      border: 1px solid #232a5c;
      border-left: 3px solid var(--rc);
      background: rgba(10, 13, 34, 0.65);
      padding: 0.5rem 0.65rem;
      display: grid;
      gap: 0.35rem;
      &.unknown {
        border-style: dashed;
        border-left-style: solid;
      }
    }
    .sig-head {
      display: flex;
      gap: 0.5rem;
      align-items: baseline;
      flex-wrap: wrap;
    }
    .sig-name {
      font-family: var(--font-display);
      color: var(--rc);
    }
    .rarity {
      font-size: 0.6rem;
      letter-spacing: 0.15em;
      color: var(--rc);
      border: 1px solid var(--rc);
      padding: 0 0.3rem;
    }
    .where {
      font-size: 0.7rem;
      color: var(--text-dim);
    }
    .expires {
      margin-left: auto;
      font-size: 0.7rem;
      color: var(--amber);
      &.soon {
        color: var(--danger);
        animation: blink 0.6s steps(2) infinite;
      }
    }
    .sig-desc {
      font-size: 0.76rem;
    }
    .hint {
      color: var(--amber);
      font-size: 0.75rem;
    }
    .btn.small {
      justify-self: start;
      font-size: 0.64rem;
      padding: 0.25rem 0.55rem;
    }
    .respond {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
      align-items: center;
    }
    select {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      background: #060818;
      color: var(--text);
      border: 1px solid var(--bezel-hi);
      padding: 0.2rem 0.3rem;
    }
    .mission {
      display: flex;
      gap: 0.6rem;
      align-items: center;
      flex-wrap: wrap;
      font-size: 0.72rem;
      color: var(--cyan);
    }
  `,
})
export class SignalsPanel {
  protected readonly game = inject(GameService);
  protected readonly s = computed(() => this.game.state()!);
  protected readonly rigCost = ANOMALY.bloomRigCost;
  protected readonly cycles = ANOMALY.derelictCycles;
  protected readonly runs = ANOMALY.battlefieldRuns;
  protected readonly fragments = ANOMALY.beaconFragments;
  protected readonly fragSec = ANOMALY.beaconSecPerFragment;
  protected readonly bloom = ANOMALY.bloomPerSec;

  protected readonly picked = signal<Record<number, number>>({});

  protected readonly speed = computed(() => A.scanSpeed(this.s()));
  protected readonly decode = computed(() => A.decodeSpeed(this.s()));
  protected readonly ready = computed(() => this.s().mechs.filter((m) => A.missionReady(this.s(), m)));

  protected readonly scan = computed(() => {
    const s = this.s();
    const sc = s.anomalies.scan;
    if (!sc) return null;
    const a = A.anomalyById(s, sc.anomalyId);
    return { name: a ? `signal in the ${zoneDef(a.zone).name}` : 'signal', remaining: sc.remaining, progress: 1 - sc.remaining / sc.duration };
  });

  protected readonly rows = computed(() => {
    const s = this.s();
    return s.anomalies.list
      .filter((a) => a.status !== 'hidden' && a.status !== 'done')
      .map((a) => {
        const def = anomalyDef(a.kind);
        return {
          a,
          def,
          zone: zoneDef(a.zone).name,
          color: a.status === 'signal' ? '#4fe3ff' : RARITY_COLOR[def.rarity],
          expires: !a.fixed && a.expires !== undefined && (a.status === 'signal' || a.status === 'scanned') ? Math.max(0, a.expires) : null,
          scanSec: A.scanDuration(s, a),
          mission: s.anomalies.missions.find((m) => m.anomalyId === a.id) ?? null,
        };
      });
  });

  protected pick(anomalyId: number, e: Event): void {
    const v = (e.target as HTMLSelectElement).value;
    this.picked.update((p) => ({ ...p, [anomalyId]: Number(v) }));
  }

  protected blocker(id: number, approach: 'drones' | 'mech', mechId?: number): string | null {
    return A.canLaunch(this.s(), id, approach, mechId);
  }

  protected chance(kind: Parameters<typeof A.missionChance>[1], approach: 'drones' | 'mech', mechId?: number): number {
    const s = this.s();
    return A.missionChance(s, kind, approach, mechId !== undefined ? s.mechs.find((m) => m.id === mechId) : null);
  }

  protected dronesFor(kind: Parameters<typeof A.dronesFor>[1]): number {
    return A.dronesFor(this.s(), kind);
  }

  protected mechName(id: number | null): string {
    const m = this.s().mechs.find((x) => x.id === id);
    return m ? m.designation : 'Mech';
  }

  protected pct(n: number): string {
    return `${Math.round(n * 100)}%`;
  }

  protected duration(sec: number): string {
    return formatDuration(sec);
  }

  protected readonly E = E;
}
