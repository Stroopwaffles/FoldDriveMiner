import { Component, computed, inject } from '@angular/core';
import { ORES, ZONES, ZoneDef } from '../game/config';
import * as E from '../game/engine';
import { researchNode } from '../game/research';
import { GameService } from '../services/game.service';

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
              <!-- Ship marker on the left edge of the current band -->
              <g class="ship-marker" [attr.transform]="'translate(' + -(62 + i * 36) + ',0)'">
                <circle r="7" fill="none" stroke="#ffb547" stroke-width="1" class="ping" />
                <polygon points="-4,5 0,-6 4,5 0,2" fill="#ffb547" />
              </g>
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
                @if (!z.current) {
                  <button type="button" class="btn btn-amber" (click)="game.setZone(z.def.id)">Set course</button>
                }
              } @else {
                <div class="zone-desc dim">Requires research: {{ z.researchName }}</div>
              }
            </div>
          }
          <p class="note">Changing zone abandons the current asteroid. Drones follow the ship and mine the new zone's mix.</p>
        </div>
      </div>
    </section>
  `,
  styleUrl: './map-panel.scss',
})
export class MapPanel {
  protected readonly game = inject(GameService);
  protected readonly s = computed(() => this.game.state()!);

  protected readonly zones = computed(() => {
    const s = this.s();
    return ZONES.map((def: ZoneDef) => ({
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
