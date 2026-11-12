import { Component, computed, inject, signal } from '@angular/core';
import { MATRIX } from '../game/core-data';
import * as E from '../game/engine';
import * as F from '../game/fold-rules';
import { FOLD, PERMANENT_NODES } from '../game/fold-data';
import { formatDuration } from '../game/format';
import { BRANCHES, RESEARCH, ResearchNode, researchNode } from '../game/research';
import { AudioService } from '../services/audio.service';
import { GameService } from '../services/game.service';

const COL_W = 196;
const NODE_W = 172;
const ROW_H = 96;
const NODE_H = 78;
const TOP = 34;

interface NodeView {
  node: ResearchNode;
  x: number;
  y: number;
  status: E.ResearchStatus;
  level: number;
  progress: number | null;
  cost: { sd: number; cr: number; sec: number; cores: number };
  affordable: boolean;
  /** QoL research kept for good through every Fold Jump. */
  permanent: boolean;
}

/** The LAB tab: lab benches plus the research tree as a circuit-board schematic. */
@Component({
  selector: 'fdm-lab-panel',
  templateUrl: './lab-panel.html',
  styleUrl: './lab-panel.scss',
})
export class LabPanel {
  protected readonly game = inject(GameService);
  private readonly audio = inject(AudioService);
  protected readonly s = computed(() => this.game.state()!);

  protected readonly branches = BRANCHES;
  protected readonly colW = COL_W;
  protected readonly nodeW = NODE_W;
  protected readonly nodeH = NODE_H;
  protected readonly top = TOP;

  /** Static layout: column per branch, row by order within the branch. */
  private readonly layout = (() => {
    const pos = new Map<string, { x: number; y: number }>();
    let maxRows = 0;
    BRANCHES.forEach((b, col) => {
      const nodes = RESEARCH.filter((n) => n.branch === b.id);
      nodes.forEach((n, row) => pos.set(n.id, { x: col * COL_W + 8, y: TOP + row * ROW_H }));
      maxRows = Math.max(maxRows, nodes.length);
    });
    return { pos, width: BRANCHES.length * COL_W, height: TOP + maxRows * ROW_H };
  })();
  protected readonly width = this.layout.width;
  protected readonly height = this.layout.height;

  protected readonly nodes = computed<NodeView[]>(() => {
    const s = this.s();
    const permanent = new Set(F.permanentNodes(s));
    return RESEARCH.map((node) => {
      const p = this.layout.pos.get(node.id)!;
      const job = s.research.active.find((j) => j.id === node.id);
      const cost = E.researchCost(s, node.id);
      return {
        node,
        x: p.x,
        y: p.y,
        status: E.researchStatus(s, node.id),
        level: E.researchLevel(s, node.id),
        progress: job ? 1 - job.remaining / job.duration : null,
        cost,
        affordable: s.surveyData >= cost.sd && s.credits >= cost.cr && s.dataCores >= cost.cores,
        permanent: permanent.has(node.id),
      };
    });
  });

  /** Circuit traces from each prerequisite to the node that needs it. */
  protected readonly traces = computed(() => {
    const s = this.s();
    const lines: { d: string; lit: boolean }[] = [];
    for (const n of RESEARCH) {
      const to = this.layout.pos.get(n.id)!;
      for (const req of n.requires) {
        const from = this.layout.pos.get(req)!;
        const x1 = from.x + NODE_W / 2;
        const y1 = from.y + NODE_H;
        const x2 = to.x + NODE_W / 2;
        const y2 = to.y;
        const midY = y2 - 10;
        const d =
          x1 === x2
            ? `M${x1},${y1} V${y2}`
            : `M${x1},${y1} V${Math.max(y1 + 8, midY)} H${x2} V${y2}`;
        lines.push({ d, lit: E.hasResearch(s, req) });
      }
    }
    return lines;
  });

  protected readonly selectedId = signal<string>('refinery');
  protected readonly selected = computed(() => this.nodes().find((n) => n.node.id === this.selectedId())!);
  /** For QoL nodes: permanent already, or how many runs until it is. */
  protected readonly qol = computed(() => {
    const id = this.selectedId();
    if (!PERMANENT_NODES.includes(id)) return null;
    const runs = this.s().fold.qolCounts[id] ?? 0;
    return { permanent: runs >= FOLD.permanentAfter, runs: Math.min(runs, FOLD.permanentAfter), need: FOLD.permanentAfter };
  });

  /** ARIA: owned, on/off, mode, and her queue with whether each can start now. */
  protected readonly aria = computed(() => {
    const s = this.s();
    const a = s.research.assistant;
    return {
      owned: E.hasAssistant(s),
      on: a.on && E.hasAssistant(s),
      mode: a.mode,
      queue: a.queue.map((id) => {
        const why = E.researchBlocker(s, id);
        return { id, name: researchNode(id).name, ready: why === null, why: why ?? '' };
      }),
    };
  });
  /** Queue position (1-based, first occurrence) per node, for the tree badges. */
  protected readonly queuePos = computed(() => {
    const out: Record<string, number> = {};
    this.s().research.assistant.queue.forEach((id, i) => (out[id] ??= i + 1));
    return out;
  });
  protected readonly queueBlocker = computed(() => E.queueBlocker(this.s(), this.selectedId()));

  protected readonly blocker = computed(() => E.researchBlocker(this.s(), this.selectedId()));

  /** Research seconds per real second, and where the bonus comes from. */
  protected readonly speed = computed(() => {
    const s = this.s();
    const mult = E.researchSpeed(s);
    const p = E.researchSpeedParts(s);
    const pct = (x: number) => `+${Math.round(x * 100)}%`;
    const lines = [
      `Science Officer: ${p.science ? pct(p.science) : 'none posted (CREW)'}`,
      `Commendations: ${p.medals ? pct(p.medals) : 'none yet'}`,
      `Core Cache (Core Matrix): ${p.matrix ? pct(p.matrix) : 'not built'}`,
      `Collegium Fellowship: ${p.fellowship ? pct(p.fellowship) : 'not a Fellow'}`,
      `Research grant: ${p.grant ? pct(p.grant) + ' for ' + formatDuration(s.trade.researchGrant) : 'none (Starward Collegium sells them)'}`,
      `Hyperthought Engine: ${p.booster ? pct(p.booster) : E.boosterLevel(s) ? 'not running (OPS)' : 'not researched'}`,
    ];
    if (p.science || p.grant || p.booster) lines.push('The Science Officer, grants and the Hyperthought Engine multiply the other bonuses.');
    return { mult, bonus: mult - 1, tip: lines.join('\n') };
  });

  protected readonly benches = computed(() => {
    const s = this.s();
    const slots = E.labSlots(s);
    const speed = E.researchSpeed(s);
    return Array.from({ length: slots }, (_, i) => {
      const job = s.research.active[i];
      return job
        ? {
            job,
            name: researchNode(job.id).name,
            progress: 1 - job.remaining / job.duration,
            remaining: formatDuration(Math.max(0, job.remaining) / speed),
            rush: E.rushCost(job),
            done: job.remaining <= 0,
          }
        : null;
    });
  });

  /** The Core Matrix: permanent bonuses bought with Data Cores. */
  protected readonly matrixOpen = signal(false);
  protected readonly matrix = computed(() => {
    const s = this.s();
    return MATRIX.map((m) => {
      const level = E.matrixLevel(s, m.id);
      const cost = E.matrixCost(s, m.id);
      return {
        m,
        level,
        cost,
        now: level ? E.matrixEffect(m, level) : 'No bonus yet',
        next: cost !== null ? E.matrixEffect(m, level + 1) : null,
        afford: cost !== null && s.dataCores >= cost,
      };
    });
  });
  protected readonly matrixLevels = computed(() => this.matrix().reduce((n, r) => n + r.level, 0));

  protected select(id: string): void {
    this.audio.blip();
    this.selectedId.set(id);
  }

  protected start(): void {
    this.game.startResearch(this.selectedId());
  }

  protected duration(sec: number): string {
    return formatDuration(sec);
  }

  /** Real time for a job of `sec` research seconds at the current speed. */
  protected realDuration(sec: number): string {
    return formatDuration(sec / this.speed().mult);
  }

  protected branchColor(id: string): string {
    return BRANCHES.find((b) => b.id === id)!.color;
  }
}
