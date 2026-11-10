import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject } from '@angular/core';
import { ORES, ZONES, ZoneDef, ZoneId } from '../game/config';
import * as E from '../game/engine';
import { researchNode } from '../game/research';
import { GameService } from '../services/game.service';
import { SettingsService } from '../services/settings.service';

/** The MAP tab: the home sector's survey zones as orbital bands. */
@Component({
  selector: 'fdm-map-panel',
  template: `
    @let st = s();
    <section class="panel map">
      <div class="panel-title">
        <span class="led"></span>Sector Map <span class="kana">ちず</span>
        <span class="sector">SECTOR {{ st.sector.code }} · {{ st.sector.name }} · {{ st.sector.star }}</span>
      </div>
      <div class="map-body">
        <svg class="orbits" viewBox="-200 -130 400 260" aria-hidden="true">
          <defs>
            <radialGradient id="map-star">
              <stop offset="0" stop-color="#fff6d0" />
              <stop offset="0.35" stop-color="#ffd23f" />
              <stop offset="1" stop-color="#ff7a3d" stop-opacity="0" />
            </radialGradient>
          </defs>
          <circle r="34" fill="url(#map-star)" />
          <circle r="11" fill="#fff1b0" />
          @for (z of zones(); track z.def.id; let i = $index) {
            <ellipse
              class="band"
              [class.locked]="!z.unlocked"
              [class.current]="z.current"
              [attr.rx]="62 + i * 36"
              [attr.ry]="(62 + i * 36) * 0.42"
              [attr.stroke]="z.def.color"
            />
            @if (z.current) {
              <!-- The ship orbits the star along its zone's band (outer bands are slower).
                   With reduced motion it sits still on the left edge. -->
              @if (still()) {
                <g class="ship-marker" [attr.transform]="'translate(' + -(62 + i * 36) + ',0) rotate(90)'">
                  <circle r="7" fill="none" stroke="#ffb547" stroke-width="1" class="ping" />
                  <polygon points="6,0 -5,-4 -2,0 -5,4" fill="#ffb547" />
                </g>
              } @else {
                <g class="ship-marker moving" [attr.data-rx]="62 + i * 36" [attr.data-period]="14 + i * 8">
                  <circle r="7" fill="none" stroke="#ffb547" stroke-width="1" class="ping" />
                  <polygon points="6,0 -5,-4 -2,0 -5,4" fill="#ffb547" />
                  <circle cx="-6" r="1.6" fill="#ff7a3d" class="exhaust" />
                </g>
              }
            }
            <!-- Labels sit at -55° on each ellipse so they fan out instead of stacking -->
            <text
              class="band-label"
              [attr.x]="(62 + i * 36) * 0.57 + 3"
              [attr.y]="-(62 + i * 36) * 0.42 * 0.82 - 3"
              [attr.fill]="z.unlocked ? z.def.color : '#4a54a0'"
            >
              {{ z.unlocked ? z.def.name : 'UNSURVEYED' }}
            </text>
          }
        </svg>

        <div class="zone-list">
          @for (z of zones(); track z.def.id) {
            <div class="zone" [class.current]="z.current" [class.locked]="!z.unlocked" [style.--zc]="z.def.color">
              <div class="zone-head">
                <span class="zone-name">{{ z.unlocked ? z.def.name : '???' }}</span>
                <span class="kana">{{ z.unlocked ? z.def.kana : '' }}</span>
                @if (z.current) {
                  <span class="here">◀ CURRENT</span>
                }
              </div>
              @if (z.unlocked) {
                <div class="zone-desc">{{ z.def.desc }}</div>
                <div class="chips">
                  @for (c of z.comp; track c.ore.id) {
                    <span class="chip" [class.slag]="!c.reachable" [style.--c]="c.ore.color">
                      {{ c.ore.code }} {{ c.pct }}%{{ c.reachable ? '' : ' · SLAG' }}
                    </span>
                  }
                </div>
                <div class="zone-stats">
                  <span>ROCK SIZE ×{{ z.def.massMult }}</span>
                  <span>SURVEY DATA {{ z.def.surveyData }}/rock</span>
                </div>
                @if (hasDispatch()) {
                  <label class="dispatch">
                    <span>DRONES</span>
                    <input type="range" min="0" max="100" step="5" [value]="z.weight" (input)="dispatch(z.def.id, $event)" [attr.aria-label]="'Drone share for ' + z.def.name" />
                    <b>{{ (z.share * 100).toFixed(0) }}%</b>
                  </label>
                }
                @if (z.mechs.length) {
                  <div class="zone-mechs">MECHS: {{ z.mechs.join(', ') }}</div>
                }
                @if (!z.current) {
                  <button type="button" class="btn btn-amber" (click)="game.setZone(z.def.id)">Set course</button>
                }
              } @else {
                <div class="zone-desc dim">Requires research: {{ z.researchName }}</div>
              }
            </div>
          }
          <p class="note">
            Changing zone abandons the current asteroid.
            @if (hasDispatch()) {
              Fleet Dispatch: drag the sliders to split mining drones between zones (all at 0 = follow the ship).
            } @else {
              Drones follow the ship and mine the new zone's mix.
            }
            Mechs mine whatever zone they're ordered to in the HANGAR.
          </p>
        </div>
      </div>
    </section>
  `,
  styleUrl: './map-panel.scss',
})
export class MapPanel {
  protected readonly game = inject(GameService);
  private readonly settings = inject(SettingsService);
  protected readonly s = computed(() => this.game.state()!);

  protected readonly still = computed(() => this.settings.reducedMotion());

  constructor() {
    // Fly the ship around its band every frame. Done in script rather than SVG
    // <animateMotion>, which Chrome doesn't reliably start on elements added later.
    const host = inject(ElementRef<HTMLElement>).nativeElement;
    let raf = 0;
    afterNextRender(() => {
      const frame = (now: number) => {
        const ship = host.querySelector('.ship-marker.moving') as SVGGElement | null;
        if (ship) {
          const rx = Number(ship.dataset['rx']);
          const ry = rx * 0.42;
          const period = Number(ship.dataset['period']) * 1000;
          const a = ((now % period) / period) * Math.PI * 2;
          const x = -rx * Math.cos(a);
          const y = ry * Math.sin(a);
          // Nose along the direction of travel (derivative of the position).
          const heading = (Math.atan2(ry * Math.cos(a), rx * Math.sin(a)) * 180) / Math.PI;
          ship.setAttribute('transform', `translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${heading.toFixed(1)})`);
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(raf));
  }

  protected readonly hasDispatch = computed(() => E.hasResearch(this.s(), 'fleet_dispatch'));

  protected dispatch(zone: ZoneId, e: Event): void {
    this.game.setDispatch(zone, Number((e.target as HTMLInputElement).value));
  }

  protected readonly zones = computed(() => {
    const s = this.s();
    const shares = E.dispatchShares(s);
    return ZONES.map((def: ZoneDef) => ({
      weight: s.dispatch[def.id] ?? 0,
      share: shares[def.id] ?? 0,
      mechs: s.mechs.filter((m) => m.zone === def.id && m.job === 'mining').map((m) => m.designation),
      def,
      unlocked: E.zoneUnlocked(s, def.id),
      current: s.zone === def.id,
      researchName: def.research ? researchNode(def.research).name : '',
      comp: ORES.filter((o) => (def.composition[o.id] ?? 0) > 0).map((o) => ({
        ore: o,
        pct: Math.round((def.composition[o.id] ?? 0) * 100),
        reachable: E.oreReachable(s, o.id),
      })),
    }));
  });
}
