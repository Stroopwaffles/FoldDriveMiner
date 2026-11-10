import { Component, computed, inject } from '@angular/core';
import { BACKGROUNDS, CREW, POSTS, PostId, STATS, traitDef, xpForLevel } from '../game/crew-data';
import * as E from '../game/engine';
import { FRAMES } from '../game/fleet-data';
import { formatDuration } from '../game/format';
import { PilotState } from '../game/types';
import { GameService } from '../services/game.service';
import { PilotPortrait } from '../ui/pilot-portrait';

/** The CREW tab: pilot dossiers, station posts and recruitment. */
@Component({
  selector: 'fdm-crew-panel',
  imports: [PilotPortrait],
  templateUrl: './crew-panel.html',
  styleUrl: './crew-panel.scss',
})
export class CrewPanel {
  protected readonly game = inject(GameService);
  protected readonly s = computed(() => this.game.state()!);

  protected readonly statDefs = STATS;
  protected readonly frames = FRAMES;
  protected readonly cap = computed(() => E.rosterCap(this.s()));
  protected readonly hireCost = computed(() => E.hireCost(this.s()));
  protected readonly rerollCost = CREW.rerollCost;
  protected readonly refreshIn = computed(() => formatDuration(this.s().recruitRefresh));
  protected readonly full = computed(() => this.s().pilots.length >= this.cap());

  protected readonly roster = computed(() => this.s().pilots.map((p) => this.dossier(p)));
  protected readonly recruits = computed(() => this.s().recruits.map((p) => this.dossier(p, true)));

  protected readonly posts = computed(() => {
    const s = this.s();
    return POSTS.map((def) => {
      const p = E.pilotById(s, s.posts[def.id]);
      return { def, pilot: p, bonus: E.postBonus(s, def.id) };
    });
  });

  private dossier(p: PilotState, recruit = false) {
    const s = this.s();
    const stats = E.pilotStats(p);
    const mech = recruit ? null : E.pilotMech(s, p);
    const post = recruit ? null : E.pilotPost(s, p);
    return {
      p,
      stats,
      bg: BACKGROUNDS.find((b) => b.id === p.background)!,
      xpNeed: xpForLevel(p.level),
      mech,
      post: post ? POSTS.find((x) => x.id === post)! : null,
      injured: E.isInjured(p),
      traits: p.traits.map((t) => traitDef(t)),
      choice: p.traitChoice?.map((t) => traitDef(t)) ?? null,
      sync: FRAMES.map((f) => ({ frame: f, level: E.syncLevel(p, f.id) })),
    };
  }

  protected assign(post: PostId, e: Event): void {
    const v = (e.target as HTMLSelectElement).value;
    this.game.assignPost(post, v === '' ? null : Number(v));
  }

  protected where(p: PilotState): string {
    const s = this.s();
    const mech = E.pilotMech(s, p);
    if (mech) return mech.designation;
    const post = E.pilotPost(s, p);
    if (post) return POSTS.find((x) => x.id === post)!.name;
    return 'available';
  }

  protected pct(n: number): string {
    return `${(n * 100).toFixed(0)}%`;
  }

  protected duration(sec: number): string {
    return formatDuration(sec);
  }

  protected readonly Math = Math;
}
