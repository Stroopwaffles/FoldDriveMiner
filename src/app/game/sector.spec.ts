import { ANOMALY, BEACON_LORE } from './anomaly-data';
import * as A from './anomaly-rules';
import { zoneDef } from './config';
import * as E from './engine';
import { CURRENT_VERSION, migrate } from './save';
import { SECTOR_TRAITS, STARS } from './sector-data';
import * as S from './sector-rules';
import { GameState, TickEvents } from './types';

function ev(): TickEvents {
  return {
    research: [],
    levelUps: [],
    syncUps: [],
    autoRepairs: [],
    threatStarted: [],
    threatResolved: [],
    anomaly: [],
    ingots: E.emptyOre(),
    autoSoldCredits: 0,
  };
}

function rich(): GameState {
  const s = E.newGame('Rook', 'Halberd Dawn', 1, 4242);
  s.credits = 1e12;
  s.surveyData = 1e6;
  s.drill.tier = 2;
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  return s;
}

/** Run time in small steps, like the real loop. */
function run(s: GameState, sec: number, step = 1): TickEvents[] {
  const out: TickEvents[] = [];
  for (let t = 0; t < sec; t += step) out.push(E.tick(s, step));
  return out;
}

describe('milestone 5a: sector generation', () => {
  it('the home sector is the familiar five zones', () => {
    const s = rich();
    const def = S.sectorOf(s);
    expect(def.code).toBe('00-H');
    expect(def.zones.map((z) => z.id)).toEqual(['inner', 'trojan', 'ring', 'ice', 'deep']);
    expect(def.traits).toEqual([]);
    expect(def.fixed.map((f) => f.kind)).toEqual(['gravity_lens', 'derelict', 'silent_beacon']);
  });

  it('generation is deterministic and respects depth gates', () => {
    for (let seed = 1; seed < 60; seed++) {
      for (const depth of [1, 2, 4, 9]) {
        const a = S.generateSector(seed * 7919, depth);
        const b = S.generateSector(seed * 7919, depth);
        expect(a).toBe(b); // cached
        expect(a.zones.length).toBeGreaterThanOrEqual(3);
        expect(a.zones.length).toBeLessThanOrEqual(5);
        expect(a.traits.length).toBeGreaterThanOrEqual(1);
        expect(a.traits.length).toBeLessThanOrEqual(3);
        expect(new Set(a.traits).size).toBe(a.traits.length);
        for (const t of a.traits) expect(SECTOR_TRAITS.find((x) => x.id === t)!.minDepth).toBeLessThanOrEqual(depth);
        for (const st of a.stars) expect(STARS.find((x) => x.id === st)!.minDepth).toBeLessThanOrEqual(depth);
        // Zones are registered so ids resolve anywhere in the game.
        for (const z of a.zones) expect(zoneDef(z.id)).toBe(z);
        expect(a.zones[0].research).toBeUndefined();
        expect(a.zones[1].research).toBe('survey_trojan');
        const sum = Object.values(a.zones[0].composition).reduce((x, y) => x + (y ?? 0), 0);
        expect(sum).toBeCloseTo(1, 6);
      }
    }
  });

  it('sector traits change the rules', () => {
    // Find a generated sector with Ion Storms and play it.
    let found: { seed: number; depth: number } | null = null;
    for (let seed = 1; seed < 500 && !found; seed++) {
      const d = S.generateSector(seed, 1);
      if (d.traits.includes('ion_storms') && !d.stars.includes('black_hole')) found = { seed, depth: 1 };
    }
    expect(found).not.toBeNull();
    const s = rich();
    const base = E.drillPower(s);
    s.sector.seed = found!.seed;
    s.sector.depth = found!.depth;
    E.syncSector(s);
    expect(S.sectorMods(s).clickPower).toBeLessThanOrEqual(0.7 + 1e-9);
    expect(E.drillPower(s)).toBeLessThan(base);
    expect(s.zone).toBe(S.sectorZones(s)[0].id); // moved into the new sector's first zone
  });

  it('pulsars surge on a cycle', () => {
    let seed = 1;
    while (!S.generateSector(seed, 1).stars.includes('pulsar')) seed++;
    const s = rich();
    s.sector.seed = seed;
    s.sector.depth = 1;
    E.syncSector(s);
    s.threats.clock = 10;
    expect(S.pulsarSurge(s)).toBe(true);
    s.threats.clock = 100;
    expect(S.pulsarSurge(s)).toBe(false);
  });

  it('the long-range scan previews three deeper sectors with hidden traits', () => {
    const s = rich();
    const d = S.destinationPreview(s);
    expect(d.length).toBe(3);
    for (const x of d) {
      expect(x.def.depth).toBe(1);
      expect(x.revealed).toBe(1);
    }
    expect(S.destinationPreview(s)[0].def).toBe(d[0].def); // stable
  });
});

describe('milestone 5a: anomalies', () => {
  it('fixed anomalies are hidden until their zone is surveyed, then scanned into the Codex', () => {
    const s = rich();
    const lens = s.anomalies.list.find((a) => a.kind === 'gravity_lens')!;
    const beacon = s.anomalies.list.find((a) => a.kind === 'silent_beacon')!;
    expect(lens.status).toBe('hidden');
    run(s, 1);
    expect(lens.status).toBe('signal'); // Inner Belt is always open
    expect(beacon.status).toBe('hidden'); // Ring Debris isn't
    expect(A.startScan(s, lens.id)).toBe(true);
    expect(A.startScan(s, lens.id)).toBe(false); // one scan at a time
    run(s, Math.ceil(A.scanDuration(s, lens)) + 1);
    expect(lens.status).toBe('scanned');
    expect(s.anomalies.codex.gravity_lens).toBe(1);
  });

  it('a mapped Gravity Lens doubles click power in its zone', () => {
    const s = rich();
    run(s, 1);
    const lens = s.anomalies.list.find((a) => a.kind === 'gravity_lens')!;
    const before = E.drillPower(s);
    lens.status = 'scanned';
    expect(E.drillPower(s)).toBeCloseTo(before * 2, 6);
  });

  it('Deep Scan research and Surveyors speed up scanning', () => {
    const s = rich();
    const base = A.scanSpeed(s);
    s.research.levels['deep_scan'] = 2;
    s.drones.surveyor = 50;
    expect(A.scanSpeed(s)).toBeCloseTo(base + 1 + 0.5, 6);
  });

  it('a tracked comet doubles its zone', () => {
    const s = rich();
    s.drones.prospector = 10;
    const before = E.droneRateTotal(s);
    const c = A.spawnAnomaly(s, 'comet', ev());
    A.startScan(s, c.id);
    run(s, 30);
    expect(c.status).toBe('active');
    expect(E.droneRateTotal(s)).toBeCloseTo(before * ANOMALY.cometMult, 6);
    run(s, ANOMALY.cometSec + 2);
    expect(E.droneRateTotal(s)).toBeCloseTo(before, 6);
  });

  it('cracking a golden asteroid pays out', () => {
    const s = rich();
    const g = A.spawnAnomaly(s, 'golden_asteroid', ev());
    g.hp = 1;
    const credits = s.credits;
    const r = A.goldenClick(s, ev())!;
    expect(r.cracked).toBe(true);
    expect(s.credits).toBeGreaterThan(credits);
  });

  it('passing anomalies expire if ignored, and never appear while away', () => {
    const s = rich();
    const w = A.spawnAnomaly(s, 'wormhole', ev());
    run(s, (w.expires ?? 0) + 2);
    expect(s.anomalies.list.find((a) => a.id === w.id)).toBeUndefined();

    const t = rich();
    t.anomalies.nextIn = 0;
    const before = t.anomalies.list.length;
    E.simulateOffline(t, 3600);
    expect(t.anomalies.list.filter((a) => !a.fixed).length).toBe(0);
    expect(t.anomalies.list.length).toBe(before);
  });

  it('derelict salvage runs pay out and return the drones', () => {
    const s = rich();
    s.research.levels['survey_trojan'] = 1;
    s.drones.prospector = 100;
    run(s, 1);
    const d = s.anomalies.list.find((a) => a.kind === 'derelict')!;
    expect(d.status).toBe('signal');
    d.status = 'scanned';
    const credits = s.credits;
    expect(A.launchMission(s, d.id, 'drones')).toBe(true);
    expect(s.drones.prospector).toBe(90);
    run(s, 125);
    expect(d.progress).toBe(1);
    expect(s.credits).toBeGreaterThan(credits);
    expect(s.drones.prospector).toBe(100);
    expect(d.status).toBe('scanned'); // can go again
  });

  it('mech missions take the mech away and bring it back', () => {
    const s = rich();
    s.research.levels['hangar'] = 1;
    s.research.levels['survey_trojan'] = 1;
    E.ensureCrew(s);
    const m = E.buildMech(s, 'kestrel')!;
    E.buyPart(s, 'fusion_cell');
    E.equipPart(s, m.id, 'reactor', 'fusion_cell');
    E.setMechJob(s, m.id, 'mining');
    const g = A.spawnAnomaly(s, 'ghost_signal', ev());
    g.status = 'scanned';
    expect(A.launchMission(s, g.id, 'mech', m.id)).toBe(true);
    expect(m.job).toBe('mission');
    expect(A.missionReady(s, m)).toBe(false);
    run(s, 95);
    expect(m.job).toBe('mining');
    expect(s.anomalies.list.find((a) => a.id === g.id)).toBeUndefined();
  });

  it('wormholes take drones and not all come back', () => {
    const s = rich();
    s.drones.prospector = 1000;
    const w = A.spawnAnomaly(s, 'wormhole', ev());
    w.status = 'scanned';
    A.launchMission(s, w.id, 'drones');
    expect(s.drones.prospector).toBe(950);
    run(s, 62);
    expect(s.drones.prospector).toBeLessThanOrEqual(1000);
    expect(s.drones.prospector).toBeGreaterThanOrEqual(950);
  });

  it('decoding the Silent Beacon reveals lore with the ship\'s name', () => {
    const s = rich();
    s.research.levels['survey_trojan'] = 1;
    s.research.levels['survey_ring'] = 1;
    run(s, 1);
    const b = s.anomalies.list.find((a) => a.kind === 'silent_beacon')!;
    b.status = 'scanned';
    expect(A.startDecode(s, b.id)).toBe(true);
    const cores = s.dataCores;
    const per = ANOMALY.beaconSecPerFragment / A.decodeSpeed(s);
    run(s, Math.ceil(per * ANOMALY.beaconFragments) + 5, 5);
    expect(s.anomalies.lore).toBe(5);
    expect(b.status).toBe('done');
    expect(s.dataCores).toBe(cores + 3);
    expect(BEACON_LORE[2]).toContain('{ship}');
  });

  it('completing a Codex set gives a permanent bonus', () => {
    const s = rich();
    s.drones.prospector = 10;
    const before = E.droneRateTotal(s);
    s.anomalies.codex = { gravity_lens: 1, derelict: 1, silent_beacon: 1 };
    expect(A.codexProductionBonus(s)).toBeCloseTo(1.05, 6);
    expect(E.droneRateTotal(s)).toBeCloseTo(before * 1.05, 6);
  });

  it('migrates a version 4 save into the seeded home sector', () => {
    const v4 = E.newGame('Rook', 'Halberd', 123456, 1) as unknown as Record<string, unknown>;
    v4['version'] = 4;
    delete v4['anomalies'];
    const sector = v4['sector'] as Record<string, unknown>;
    delete sector['seed'];
    const m = migrate(v4);
    expect(m.version).toBe(CURRENT_VERSION);
    expect(m.sector.seed).toBe(123456);
    expect(m.anomalies.list.map((a) => a.kind)).toEqual(['gravity_lens', 'derelict', 'silent_beacon']);
  });
});
