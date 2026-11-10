import { formatDuration } from '../game/format';
import { siteDef } from '../game/special-data';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { ORES, ZoneDef, ZoneId } from '../game/config';
import { RARITY_COLOR, anomalyDef } from '../game/anomaly-data';
import * as E from '../game/engine';
import * as S from '../game/sector-rules';
import * as F from '../game/fold-rules';
import { GameService } from '../services/game.service';
import { SettingsService } from '../services/settings.service';
import { CodexPanel } from './codex-panel';
import { SignalsPanel } from './signals-panel';

type MapTab = 'zones' | 'signals' | 'codex' | 'range';

/** Band radius for zone i on the orbit map. */
const R = (i: number) => 52 + i * 30;

/** The MAP tab: the sector's zones as orbital bands, anomaly signals, the Codex and the long-range scan. */
@Component({
  selector: 'fdm-map-panel',
  imports: [SignalsPanel, CodexPanel],
  templateUrl: './map-panel.html',
  styleUrl: './map-panel.scss',
})
export class MapPanel {
  protected readonly game = inject(GameService);
  private readonly settings = inject(SettingsService);
  protected readonly s = computed(() => this.game.state()!);
  protected readonly R = R;

  protected readonly tab = signal<MapTab>('zones');
  protected readonly still = computed(() => this.settings.reducedMotion());

  // ---------------------------------------------------------------- sector header
  protected readonly sector = computed(() => {
    const s = this.s();
    const def = S.sectorOf(s);
    return {
      def,
      star: S.mainStar(def),
      starLabel: S.starLabel(def),
      profile: S.profileDef(def.profile),
      traits: def.traits.map((t) => S.sectorTraitDef(t)),
    };
  });

  /** Signals waiting for a scan or a response (for the tab badge). */
  protected readonly signalCount = computed(
    () => this.s().anomalies.list.filter((a) => a.status === 'signal' || (a.status === 'scanned' && !a.fixed)).length,
  );

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
    return S.sectorZones(s).map((def: ZoneDef, i) => {
      const anomalies = s.anomalies.list.filter((a) => a.zone === def.id && a.status !== 'hidden' && a.status !== 'done');
      return {
        i,
        weight: s.dispatch[def.id] ?? 0,
        share: shares[def.id] ?? 0,
        mechs: s.mechs.filter((m) => m.zone === def.id && m.job === 'mining').map((m) => m.designation),
        def,
        unlocked: E.zoneUnlocked(s, def.id),
        current: s.zone === def.id,
        /** The zone the next sector scan would chart. */
        next: !E.zoneUnlocked(s, def.id) && S.nextChartZone(s)?.id === def.id,
        comet: E.zoneBoost(s, def.id) > 1,
        site: def.site ? siteDef(def.site) : null,
        specialOdds: (E.specialChance(s, def) * 100).toFixed(1),
        anomalies: anomalies.map((a, k) => ({
          a,
          label: a.status === 'signal' ? 'Unknown signal' : anomalyDef(a.kind).name,
          color: a.status === 'signal' ? '#4fe3ff' : RARITY_COLOR[anomalyDef(a.kind).rarity],
          // Markers sit at the bottom of the band, spread out.
          x: -R(i) * Math.cos(Math.PI / 2 + 0.5 + k * 0.45),
          y: R(i) * 0.42 * Math.sin(Math.PI / 2 + 0.5 + k * 0.45),
        })),
        comp: ORES.filter((o) => (def.composition[o.id] ?? 0) > 0).map((o) => ({
          ore: o,
          pct: Math.round((def.composition[o.id] ?? 0) * 100),
          reachable: E.oreReachable(s, o.id),
        })),
      };
    });
  });

  // ---------------------------------------------------------------- sector scans
  protected readonly scan = computed(() => {
    const s = this.s();
    const next = S.nextChartZone(s);
    const cost = next ? S.scanCost(s, next.index) : null;
    const run = s.sector.scan;
    return {
      next,
      cost,
      costLabel: cost ? `${this.game.fmt(cost.sd)} SD · ${formatDuration(cost.sec)}` : '',
      blocker: S.scanBlocker(s),
      running: run,
      progress: run ? 1 - run.remaining / run.duration : 0,
      eta: run ? formatDuration(Math.max(0, run.remaining)) : '',
      charted: S.chartedZones(s),
      total: S.sectorZones(s).length,
    };
  });

  // ---------------------------------------------------------------- long-range scan
  protected readonly destinations = computed(() =>
    S.destinationPreview(this.s(), F.destinationCount(this.s()), F.revealedTraits(this.s())).map(({ def, revealed }) => ({
      def,
      star: S.mainStar(def),
      starLabel: S.starLabel(def),
      profile: S.profileDef(def.profile),
      traits: def.traits.map((t, k) => (k < revealed ? S.sectorTraitDef(t) : null)),
      zones: def.zones.length,
    })),
  );

  protected readonly fold = computed(() => F.driveOnline(this.s()));

  protected setTab(t: MapTab): void {
    this.tab.set(t);
  }
}
