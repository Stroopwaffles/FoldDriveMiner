import * as E from './engine';
import * as F from './fold-rules';
import { CURRENT_VERSION, migrate } from './save';
import { GameState } from './types';

function lab(): GameState {
  const s = E.newGame('Rook', 'Halberd', 1, 21);
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  s.trade.nextIn = Infinity;
  s.credits = 1e9;
  s.surveyData = 1e5;
  s.research.levels['lab_assistant'] = 1;
  s.research.levels['lab_slot_2'] = 1;
  return s;
}

describe('ARIA, the research assistant', () => {
  it('needs her research before she can switch on or queue', () => {
    const s = lab();
    delete s.research.levels['lab_assistant'];
    expect(E.setAssistant(s, true)).toBe(false);
    expect(E.enqueue(s, 'depletion_bonus')).toBe(false);
  });

  it('fills empty benches from the queue, in order', () => {
    const s = lab();
    E.enqueue(s, 'depletion_bonus');
    E.enqueue(s, 'cargo_compression');
    E.enqueue(s, 'core_sampling');
    E.setAssistant(s, true);
    const ev = E.tick(s, 1);
    expect(s.research.active.map((j) => j.id)).toEqual(['depletion_bonus', 'cargo_compression']);
    expect(ev.assistantStarted).toEqual(['Fracture Mapping', 'Cargo Compression']);
    expect(s.research.assistant.queue).toEqual(['core_sampling']);
  });

  it('starts the next project as soon as a bench frees up', () => {
    const s = lab();
    delete s.research.levels['lab_slot_2'];
    E.enqueue(s, 'depletion_bonus');
    E.enqueue(s, 'core_sampling');
    E.setAssistant(s, true);
    E.tick(s, 1);
    expect(s.research.active.map((j) => j.id)).toEqual(['depletion_bonus']);
    s.research.active[0].remaining = 0.5;
    E.tick(s, 1);
    expect(s.research.levels['depletion_bonus']).toBe(1);
    expect(s.research.active.map((j) => j.id)).toEqual(['core_sampling']);
  });

  it('skips queued projects that cannot start yet, keeping their place', () => {
    const s = lab();
    delete s.research.levels['lab_slot_2'];
    E.enqueue(s, 'refinery_speed'); // needs the Refinery first
    E.enqueue(s, 'depletion_bonus');
    E.setAssistant(s, true);
    E.tick(s, 1);
    expect(s.research.active.map((j) => j.id)).toEqual(['depletion_bonus']);
    expect(s.research.assistant.queue).toEqual(['refinery_speed']);
  });

  it('does nothing when switched off, and waits when it cannot pay', () => {
    const s = lab();
    E.enqueue(s, 'depletion_bonus');
    E.tick(s, 1);
    expect(s.research.active.length).toBe(0);
    E.setAssistant(s, true);
    s.surveyData = 0;
    E.tick(s, 1);
    expect(s.research.active.length).toBe(0);
    expect(s.research.assistant.queue).toEqual(['depletion_bonus']);
  });

  it('queue + cheapest picks the cheapest available project, never one that costs Data Cores', () => {
    const s = lab();
    s.dataCores = 100;
    E.setAssistantMode(s, 'auto');
    E.setAssistant(s, true);
    E.tick(s, 1);
    expect(s.research.active.length).toBe(2);
    for (const j of s.research.active) expect(j.paidCores ?? 0).toBe(0);
    expect(s.dataCores).toBe(100);
  });

  it('queue only leaves benches empty when the queue runs dry', () => {
    const s = lab();
    E.setAssistant(s, true);
    E.tick(s, 1);
    expect(s.research.active.length).toBe(0);
  });

  it('will not queue more levels than a node has left', () => {
    const s = lab();
    expect(E.enqueue(s, 'refinery')).toBe(true); // max level 1
    expect(E.enqueue(s, 'refinery')).toBe(false);
    for (let i = 0; i < 5; i++) expect(E.enqueue(s, 'depletion_bonus')).toBe(true); // 5 levels
    expect(E.enqueue(s, 'depletion_bonus')).toBe(false);
  });

  it('is QoL: settings and queue survive a Fold Jump, and she becomes permanent after two runs', () => {
    const s = lab();
    E.setAssistant(s, true);
    E.setAssistantMode(s, 'auto');
    E.enqueue(s, 'depletion_bonus');
    s.research.levels['fold_drive'] = 1;
    s.fold.charge = 1;
    s.stats.creditsEarned = 1e8;
    s.fold.qolCounts['lab_assistant'] = 1;
    const n = F.foldJump(s)!.state;
    expect(n.research.assistant.on).toBe(true);
    expect(n.research.assistant.mode).toBe('auto');
    expect(n.research.assistant.queue).toEqual(['depletion_bonus']);
    expect(E.hasAssistant(n)).toBe(true); // second run with her: permanent
  });

  it('older saves load with ARIA off and an empty queue', () => {
    const old = E.newGame('Rook', 'Halberd', 1, 5) as unknown as { research: Record<string, unknown> } & Record<string, unknown>;
    delete old.research['assistant'];
    const m = migrate(old);
    expect(m.version).toBe(CURRENT_VERSION);
    expect(m.research.assistant.on).toBe(false);
    expect(m.research.assistant.queue).toEqual([]);
  });
});
