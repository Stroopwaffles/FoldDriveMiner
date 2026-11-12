# Fold Drive Miner

**フォールドドライブ・マイナー** — an idle space-mining game with an 80s mecha-anime look.

### ▶ [Play it in your browser](https://stroopwaffles.github.io/FoldDriveMiner/)

You command the *Halberd Dawn*, a Meridian Heavy Industries "Fold-class" mining ship sent to the frontier.
Crack asteroids, build up a fleet of drones and mechs, refine and sell ore, and fold to deeper,
richer sectors. Somewhere along the way you start to notice that the Fold Drive doesn't take you
where Meridian says it does.

## What's in the game

- **Mining and industry:** click (or hold) to drill, upgrade the drill through five tiers, and run
  a refinery and alloy forge. Fleets of Prospector, Cutter, Hauler, Surveyor, Salvager and Guardian
  drones work the asteroid for you.
- **Research:** a tech tree in the Lab with up to three benches, ARIA the research assistant, the
  Hyperthought Engine booster, and permanent quality-of-life research.
- **Mechs and pilots:** build Pickaxe, Kestrel and Bulwark frames, fit parts, save loadouts, and
  train a crew of pilots with traits, bonds and Special Techniques.
- **Threats:** Pirate Heat, raids led by rival captains and the Vermilion Jackal, strikes on the
  pirate base, solar flares, rogue asteroids and more.
- **Exploration:** procedurally generated sectors with their own stars, traits and zones, plus
  anomalies to scan, a Codex, a collection of curios, and merchant convoys and corporate contracts.
- **Fold Jumps:** a prestige loop. Charge the Fold Drive with Helium-3, jump deeper, earn Fold
  Resonance and spend it in the Jump Core.
- **Story:** 26 episodes in three acts, side stories, two endings with their own epilogues, and
  98 commendations to earn.
- **Idle-friendly:** progress continues while you're away, with a report waiting when you return.
  Saves live in your browser and can be exported and imported as text.

## Built with

- [Angular](https://angular.dev) 22: standalone components, signals and zoneless change detection.
- Game rules are plain TypeScript modules in `src/app/game/`, separate from the UI in
  `src/app/game-shell/` and `src/app/ui/`.
- Art, animation and music are made in code (SVG, CSS and the Web Audio API). There are no image or
  audio assets.
- Unit tests run with [Vitest](https://vitest.dev/).

This game was made entirely with AI.

## Running it locally

```bash
npm install
```

```bash
npx ng serve
```

Then open `http://localhost:4200/`. The page reloads whenever you change a source file.

Run the tests:

```bash
npx ng test --watch=false
```

Make a production build (output goes to `dist/`):

```bash
npx ng build
```

## Deployment

Every push to `main` runs the tests, builds the game and publishes it to GitHub Pages through
`.github/workflows/deploy-pages.yml`.
