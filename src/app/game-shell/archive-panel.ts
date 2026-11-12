import { Component, computed, inject, signal } from '@angular/core';
import { BackgroundId, backgroundDef } from '../game/crew-data';
import { formatDuration } from '../game/format';
import { BONUS_LABEL, BonusKind, CATEGORIES, MEDALS } from '../game/medal-data';
import * as S from '../game/sector-rules';
import { ACTS, EPILOGUE, EPISODES, FINALE, LAST_OFFER, MASTER_EPILOGUE, episodeGoals } from '../game/story-data';
import * as ST from '../game/story-rules';
import { LogEntry } from '../game/types';
import { AudioService } from '../services/audio.service';
import { GameService } from '../services/game.service';
import { PilotPortrait } from '../ui/pilot-portrait';

type ArchiveTab = 'episodes' | 'medals' | 'logbook' | 'dossiers' | 'records';

/** The ARCHIVE: episode replays, commendations, the Sector Logbook, dossiers and records. */
@Component({
  selector: 'fdm-archive-panel',
  imports: [PilotPortrait],
  templateUrl: './archive-panel.html',
  styleUrl: './archive-panel.scss',
})
export class ArchivePanel {
  protected readonly game = inject(GameService);
  private readonly audio = inject(AudioService);
  protected readonly s = computed(() => this.game.state()!);
  protected readonly tab = signal<ArchiveTab>('episodes');
  protected readonly tabs: { id: ArchiveTab; label: string }[] = [
    { id: 'episodes', label: 'EPISODES' },
    { id: 'medals', label: 'COMMENDATIONS' },
    { id: 'logbook', label: 'SECTOR LOGBOOK' },
    { id: 'dossiers', label: 'DOSSIERS' },
    { id: 'records', label: 'RECORDS' },
  ];
  protected readonly duration = formatDuration;

  // ---------------------------------------------------------------- episodes
  protected readonly acts = computed(() => {
    const st = this.s().story;
    return [1, 2, 3].map((act) => ({
      name: ACTS[act],
      episodes: EPISODES.filter((e) => e.act === act).map((e) => ({
        def: e,
        state:
          e.n <= st.watched ? 'watched' : e.n === st.watched + 1 && e.n <= st.unlocked ? 'ready' : e.n <= st.unlocked ? 'queued' : e.n === st.unlocked + 1 ? 'next' : 'locked',
      })),
    }));
  });
  /** Progress toward the next episode's milestone. */
  protected readonly Math = Math;
  protected readonly epilogueTitle = EPILOGUE.title;
  protected readonly masterTitle = MASTER_EPILOGUE.title;
  protected readonly offerTitle = LAST_OFFER.title;
  protected readonly nextGoals = computed(() => {
    const s = this.s();
    const g = episodeGoals(s.story.unlocked + 1, s);
    if (!g) return null;
    const goals = g.goals.map((x) => ({ ...x, done: x.value >= x.target, pct: Math.min(100, (x.value / x.target) * 100) }));
    return { any: g.any, goals, met: g.any ? goals.some((x) => x.done) : goals.every((x) => x.done) };
  });

  /** What the next episode is waiting for. */
  protected readonly nextNote = computed(() => {
    const s = this.s();
    const st = s.story;
    if (st.watched < st.unlocked) return 'Watch the waiting episode first';
    const wait = ST.episodeWait(s);
    if (wait <= 0) return '';
    return this.nextGoals()?.met
      ? `Milestone met. Arrives after your next Fold Jump or in ${formatDuration(wait)}`
      : `Once its milestone is met, it arrives after your next Fold Jump or in ${formatDuration(wait)}`;
  });

  protected readonly finale = computed(() => {
    const c = this.s().story.choice;
    return c ? FINALE[c] : null;
  });
  protected readonly sides = computed(() => Array.from({ length: this.s().story.side }, (_, i) => ({ n: i + 1, title: ST.sideStory(i + 1).title })));

  protected play(n: number): void {
    this.game.playEpisode(n);
  }

  protected playSide(n: number): void {
    this.game.playSide(n);
  }

  // ---------------------------------------------------------------- commendations
  protected readonly medalCount = computed(() => Object.keys(this.s().story.medals).length);
  protected readonly medalTotal = MEDALS.length;
  protected readonly bonuses = computed(() =>
    (Object.keys(BONUS_LABEL) as BonusKind[]).map((k) => ({ label: BONUS_LABEL[k], pct: Math.round(ST.medalBonus(this.s(), k) * 100) })),
  );
  protected readonly categories = computed(() => {
    const earned = this.s().story.medals;
    return CATEGORIES.map((c) => {
      const list = MEDALS.filter((m) => m.category === c.id).map((m) => {
        const got = earned[m.id] !== undefined;
        // Progress toward ones not yet earned (secrets stay hidden).
        const p = !got && !m.secret && m.progress ? m.progress(this.s()) : null;
        const progress = p ? { value: Math.min(p.value, p.target), target: p.target, pct: Math.min(100, (Math.max(0, p.value) / p.target) * 100) } : null;
        return { def: m, earned: got, progress };
      });
      return { ...c, list, got: list.filter((x) => x.earned).length };
    });
  });

  protected pct(x: number): number {
    return Math.round(x * 100);
  }

  protected bonusLabel(k: BonusKind): string {
    return BONUS_LABEL[k];
  }

  // ---------------------------------------------------------------- logbook
  protected readonly logbook = computed(() => {
    const s = this.s();
    return [...s.story.logbook].reverse().map((e: LogEntry) => ({
      e,
      here: e.left === null,
      profile: S.profileDef(e.profile).name,
      traits: e.traits.map((t) => S.sectorTraitDef(t).name),
      t: ST.logTotals(s, e),
    }));
  });

  // ---------------------------------------------------------------- dossiers
  protected readonly crew = computed(() => this.s().pilots);
  protected readonly dismissed = computed(() => [...this.s().story.dismissed].reverse());
  protected bg(id: string): string {
    return backgroundDef(id as BackgroundId).name;
  }

  // ---------------------------------------------------------------- records
  protected readonly records = computed(() => {
    const s = this.s();
    const st = s.stats;
    const t = s.threats;
    const f = this.game.fmt.bind(this.game);
    return [
      ['Playtime', formatDuration(s.playtimeSec)],
      ['Drill clicks', f(st.clicks)],
      ['Overdrive clicks', f(st.overdriveClicks)],
      ['Overheats', f(st.overheats)],
      ['Asteroids cracked', f(st.asteroidsCracked)],
      ['Ore mined', `${f(st.oreMined)} t`],
      ['Ore lost to a full hold', `${f(st.oreLost)} t`],
      ['Ingots refined', f(st.ingotsRefined)],
      ['Credits earned', `${f(st.creditsEarned)} cr`],
      ['Research completed', f(st.researchCompleted)],
      ['Mechs built', f(st.mechsBuilt)],
      ['Raids won / lost', `${t.raidsWon} / ${t.raidsLost}`],
      ['Jackal encounters / defeats', `${t.jackalEncounters} / ${t.jackalDefeats}`],
      ['Pirate base strikes won', String(t.strikesWon)],
      ['Contracts completed / failed', `${s.contracts.completed} / ${s.contracts.failed}`],
      ['Merchant convoys', String(s.stats.convoysHosted ?? 0)],
      ['Anomalies identified', String(Object.values(s.anomalies.codex).reduce<number>((a, b) => a + (b ?? 0), 0))],
      ['Beacon fragments decoded', String(s.anomalies.lore)],
      ['Fold Jumps', String(s.fold.jumps)],
      ['Lifetime Fold Resonance', String(s.fold.lifetimeResonance)],
      ['Deepest sector', String(s.sector.depth)],
      ['Sectors visited', String(s.story.logbook.length)],
    ];
  });

  protected setTab(t: ArchiveTab): void {
    this.audio.blip();
    this.tab.set(t);
  }
}
