# Fold Drive Miner — Game Design

An idle space-mining game, built as a single-page Angular app, styled after 80s / early-90s mecha anime (retro-futurism). All characters, names and art are original; names marked *(placeholder)* may change.

> Status legend: **Decided** = confirmed by the designer. **Assumed** = proposed and used by later sections, not yet explicitly confirmed.

---

## 0. Pillars

- **Idle-first, active-rewarding.** The game progresses unattended; active play (clicking, timing, choosing) speeds it up.
- **The reset is the story.** Prestige (the Fold Jump) is the central plot device.
- **Attachment through pilots.** Pilots are the one thing that persists with full progress.
- **Every sector is different.** Procedural sectors, anomalies, merchants and local outfits keep runs fresh.
- **Look and sound like an 80s anime opening.**

### Core loop
Mine ore → sell / refine → buy upgrades → mine faster → unlock deeper survey zones → charge the Fold Drive → jump to a new sector (prestige).

---

## 1. Core loop & economy *(Assumed — open questions noted at end)*

### Resources
| Tier | Ore | Base value | Unlock |
|---|---|---|---|
| T1 | Ferrite | 1 cr | Start |
| T2 | Titanite | 8 cr | Drill Mk.II |
| T3 | Iridium | 60 cr | Drill Mk.III |
| T4 | Helium-3 | 450 cr | Drill Mk.IV + Cryo Hold |
| T5 | Voidglass (exotic) | 4,000 cr | Late research / deep sectors |

- **Credits (cr)** — main currency.
- **Survey Data** — research currency (see §5). *(Decided)*
- **Data Cores** — rare currency from asteroid depletion (~1–2%), anomalies, sorties.
- **Ingots / Alloys** — refined goods.

### Manual drilling
- One asteroid on screen; has **mass** and **composition** (e.g. 70% Ferrite / 25% Titanite / 5% Iridium).
- Each click removes ore equal to **drill power**, split by composition; ores above the drill's tier become slag.
- Depletion: bonus ore, chance of Data Core, small Survey Data, new asteroid drifts in.
- **Drill heat / Overdrive:** rapid clicks build heat; the red zone triggers OVERDRIVE (3× power); overheating locks the drill briefly.

### Idle production
- **Prospector Drone Mk.I** is the first generator. Drones mine the sector/zone field average, not the on-screen asteroid.
- `cost = base × 1.15^owned`; output doubles at 25/50/100… owned.

### Cargo hold
- Capacity-limited; mining stops when full. Upgrades: capacity, then **Auto-Sell** (research).

### Market
- Sell per ore; prices drift ±20% over minutes (scrolling ticker). Market events (Boom / Crash) in §6.

### Refinery
- 10 ore → 1 ingot worth ~14× base, timed batches in slots. Upgrades: speed, yield, slots, **Auto-Refine**; later **alloys** (two ores).

### Offline progress
- Simulated on return at **50% efficiency, capped at 8 h** (raised by research/Jump Core). Shows a "WELCOME BACK, COMMANDER" report.

### Pacing targets (first run)
| Milestone | Target |
|---|---|
| First drone | ~30 s |
| Cargo becomes a constraint | ~3 min |
| Titanite | ~10 min |
| Refinery | ~15 min |
| Iridium | ~1 h |
| First Fold Jump available | ~3–5 h |

---

## 2. Fleet *(Decided)*

### Drones
| Drone | Role |
|---|---|
| Prospector Mk.I | Basic ore/s |
| Cutter | Favors higher-tier ore |
| Hauler | Raises cargo capacity, feeds refinery |
| Surveyor | Scan speed, anomaly detection, Survey Data |
| Guardian | Raid defense; absorbs losses |
| Salvager | Recovers wrecks, depletion bonus |

- Buy ×1 / ×10 / Max.
- **Losses** (missions, raids, hazards) leave **wrecks**, rebuildable at 25% of current cost; uncollected wrecks drift away.
- **Fleet Dispatch** (split drones across zones by %) is a **mid-game research unlock** so new players aren't overwhelmed.

### Mechs
- **Hangar bays:** 1 → ~6 (research + Jump Core).
- Jobs: **Mining** (big output + **Command Link** boost to drones in its zone), **Mission**, **Defense standby**, **In repair**.
- **Frames:** Pickaxe (mining), Kestrel (scout/missions), Bulwark (defense), Prototype/Ace frames (blueprints, anomalies, merchants).
- **Part slots:** Drill Arm, Off-hand, Reactor, Thrusters, Sensor Head, Armor Plating.
- **Power budget loadout puzzle:** reactor supplies power, parts draw it. *(Kept — designer finds it interesting.)*
- Stats: Mining, Combat, Speed, Sensors, Armor, Power.
- Part rarity: Standard → Surplus → Sector-unique (merchants) → Legendary (anomalies); Rare+ parts carry a perk.
- Unpiloted mechs run on autopilot at reduced efficiency.
- Designation + name (e.g. **FDM-07 "Kestrel"**), portrait assembled from part layers, cosmetic paint schemes, catapult launch animation.

### Damage & repair
| State | Armor | Effect |
|---|---|---|
| Operational | > 50% | Full |
| Damaged | 25–50% | −25% |
| Critical | < 25% | −50%, no missions/sorties |
| Disabled | 0% | Out of action until repaired |

- **Mechs bottom out at Disabled — never destroyed.**
- **Repair Bay:** time + credits + base ore (Ferrite/Titanite). Upgrades: speed, slots, auto-repair. Merchant **repair kits** are instant.
- **Risk preview** before every dispatch (success, damage, drone-loss odds).

### Across a jump
- Mechs, drones and parts in the field are left behind; **blueprints persist** (cheap rebuilds); **Unique/Legendary parts persist in the Jump Core Vault**.

---

## 3. Pilots & crew *(Decided)*

- **Roster (Crew Quarters):** starts at 4, up to ~12; **always at least 2 more than hangar bays**, so some pilots stay on the station. Pilots can be dismissed.
- **Sources:** starting pilot, per-sector station roster (2–3 hires), merchant contracts, anomalies, story.
- **Exactly 4 hand-written story pilots**; all others procedurally generated (name pools + layered SVG portraits).
- **Stats:** Piloting, Prospecting, Engineering (also lowers part power draw), Instinct, Nerve.
- **Backgrounds:** Ace, Rookie, Engineer, Prospector, Ex-Pirate, Scholar, Trader.
- **Traits** (1–3): e.g. Hot-Blooded, Silver-Tongued, Steady Hands, Reckless, Lucky, Night Owl, Grudge (Pirates), Green (rookie, removed at Lv 10). Choose 1 of 2 new traits every 10 levels.
- **Levels:** cap 50, then repeatable **Ace Ranks**. XP from missions/sorties (fast) and mining (slow).
- **Sync** per frame type (1–5). At **Sync 5** a pilot+frame pair unlocks a **Special Technique** with a **full-screen cut-in animation**.
- **Injuries:** pilot is injured/benched when their mech is Disabled. Medbay speeds recovery. **A Fold Jump heals everyone.** **Pilots never die.**
- **Station posts** (for pilots not in mechs; injured pilots can do light duty at 50%):
  | Post | Bonus |
  |---|---|
  | Refinery Overseer | Refinery speed/yield |
  | Repair Chief | Repair speed |
  | Sensor Officer | Scans, anomaly detection |
  | Quartermaster | Market prices, merchant deals |
  | Flight Instructor | Passive XP for others |
  | Science Officer | Survey Data, research breakthroughs |
- **Bonds:** Rivals (+10% together, banter), Partners (evasion, cover on failure), Mentor/Student (XP).
- **Persist across jumps with full levels.**
- Dossier-style UI: classified stamp, portrait, stat radar, traits, sync bars, bonds, service record.

---

## 4. Sectors & anomalies *(Decided)*

### Sector generation
Seed + depth (jumps so far). A sector = one run.

- **Star type:** Red Dwarf (calm, low yield), Yellow (balanced), Blue Giant (refinery +50%, flares), Pulsar (periodic surge windows), Nebula (anomalies up, scan range down), Black Hole (deep only; Voidglass, offline +, clicks −), Binary (rare; combined traits).
- **Ore profile:** e.g. Titanite-heavy, Iridium veins, Helium-3 ice belts, Poor (yield −, anomalies +).
- **Traits (1–3, more/rarer when deeper):** Dense Field, Pirate Haven, Ion Storms, Trade Hub Nearby, Micrometeor Swarm, Ancient Survey Marker, Gravity Shear, …
- **Survey zones (3–5, generated):** orbital bands (Inner Belt → Trojan Cluster → Ring Debris → Ice Halo → Deep Field…), each with ore profile, asteroid size, hazard level, anomaly chance.
- **Destination choice:** 3 options at jump; **some traits hidden as `???`** *(Decided)*. Long-Range Sensors (Jump Core) reveals more and adds a 4th option.
- Generated names: e.g. **"Sector 14-R · Veil of Kestrel"** with a briefing line.

### Anomalies
Events are threats; **anomalies are opportunities and mysteries**.

- **Fixed** (rolled with the sector, hidden until surveyed): Derelict Megastructure, Crystal Bloom, Gravity Lens, **Silent Beacon**, Frozen Battlefield.
- **Passing** (expire): Comet Pass, Wormhole Flicker, Ghost Signal, Golden Asteroid, Stellar Leviathan (Legendary), **Merchant Fleet**.
- **Flow:** Detect → Scan → Respond (send drones / dispatch mech + pilot / ignore) → Outcome transmission.
- **Missions can lose drones and damage mechs.** *(Decided)*
- **Rarity:** Common (any) / Uncommon (depth 2+) / Rare (4+) / Legendary (8+). At least one anomaly per sector.
- **Anomaly Codex** persists; completing sets gives permanent bonuses.

### Merchant fleets *(designer's addition)*
- Traveling trader clans with their own crude fold drives (lore hook). Stay ~15–30 min; if they arrive offline they wait until shortly after the player returns.
- **Clans** *(placeholders)*: Halcyon Free Traders (mech parts, cosmetics), Grey Tithe Convoy (relics, lore, Fold Drive hints), Okonkwo-Varga Salvage Combine (drones, repair, blueprints), The Lantern Market (black market; Pirate Haven sectors only).
- **Stock** generated from sector seed + depth + clan:
  - Sector-bound: local star charts (hidden anomaly / secret zone), sector ore contracts, hazard countermeasures.
  - Portable: sector-named unique mech parts, blueprints, pilot contracts, curios.
  - Consumables: Overdrive cells, drone replacements, repair kits, Fold charge cells, pirate deterrent beacons.
- **Payment:** credits, **ore barter** (each clan wants certain ores), Data Cores for rare stock.
- **Reputation** per clan, **persists across jumps**; tiers unlock stock, discounts, extra visits, a clan-exclusive item.
- Side events: escort requests, Lantern Market stings, captain's favors.

---

## 5. Research *(Decided)*

- **Cost:** **Survey Data** (separate resource) + credits. Survey Data from depletion, Surveyor drones, anomaly scans, Science Officer.
- **Timed projects** in lab slots (1 → 3). Early 30 s–2 min, mid 10–30 min, late hours.
- **EUREKA breakthroughs:** small chance on completion (refund / free level / perk), boosted by Science Officer.
- **Branches** (circuit-board schematic UI):
  - **Extraction:** Drill Mk.II–V, power, heat, Overdrive, depletion bonus, Cryo Hold.
  - **Logistics:** cargo, Auto-Sell, market analysis, **Fleet Dispatch**, hauler throughput.
  - **Fleet Engineering:** drone unlocks, milestones, hangar bays, reactor efficiency, Repair Bay.
  - **Refinery:** unlock, speed, yield, slots, Auto-Refine, alloys.
  - **Sensors & Survey:** scan speed, detection, survey zone unlocks, risk-preview accuracy, Survey Data gain.
  - **Station:** Medbay, temporary roster slots, post strength, offline efficiency/cap.
  - **Fold Science:** **Fold Drive** (gates first prestige), charge efficiency, over-charge cap, beacon decoding.
- **Gating** by sector depth, codex entries, merchant reputation.
- **Resets on jump.** **Research Archive** (Jump Core) lets the player **pick** nodes to keep. **QoL unlocks become permanent** after being researched a few times.

---

## 6. Events & sorties *(Decided)*

### Threat events
| Event | Response |
|---|---|
| Pirate Raid | Sortie or surrender cargo |
| Solar Flare | Shelter drones (pause) or ride it out (losses) |
| Rogue Asteroid | Crack by clicking or mech intercept (big reward) |
| Micrometeor Storm | Slow drone attrition; Guardians/armor mitigate |
| Reactor Fault | Production down until fixed (Engineer / Repair Chief) |
| Comms Blackout | Market/merchants/scans unavailable briefly |
| Ore Boom / Market Crash | Temporary price spikes/drops |

- Frequency from star type, traits, zone hazard, depth, and **Pirate Heat** (rises with wealth; lowered by deterrents and victories).
- **Grace period:** ~20 min with no hostile events in the very first run.
- **Standing Orders:** preset automatic responses per event; manual override during the warning countdown.
- **Offline:** resolved by Standing Orders, summarized in the welcome-back report. **Loss cap per absence: ~10% of drones, ~25% of cargo.**

### Sorties
- **Fully automatic.** Player choices happen before launch only (which mechs, pilots, Guardian drones; risk preview).
- Presentation: tactical radar display, combat log, pilot barks, Sync-5 cut-ins; 20–60 s; skippable; fully auto offline.
- Outcomes: Victory / Costly Victory / Defeat (cargo stolen, drones lost, mechs damaged → possible pilot injury).
- Enemies: pirate skiffs, gunboats, Rogue Frames (pirate mechs).
- **Recurring rival — the Vermilion Jackal** *(placeholder)*: named Pirate Ace who follows the player across sectors (has fold tech), taunts, escapes, returns stronger.
- **Strike sorties** against pirate bases in later zones (big reward, Heat reset, Rogue Frame blueprints).
- Used for raids, merchant/corporate escorts, rogue asteroid intercepts, some anomaly missions.

---

## 7. Contracts *(Decided)*

### Megacorps *(placeholders)* — standing persists across jumps
| Corp | Specialty |
|---|---|
| Meridian Heavy Industries | Bulk ore/ingots — **built the player's ship and Fold Drive; tied to the mystery** |
| Aster-Lune Energy | Helium-3, Voidglass, Fold charge |
| Orrery Survey Institute | Scans, anomalies, Survey Data, zones |
| Vanguard Security Concern | Bounties, escorts, Rogue Frames |

### Sector-local outfits *(designer's addition)*
- **0–2 generated per sector**, existing only there: Mining Cooperative, Frontier Colony, Research Outpost, Local Militia, Pilgrim Sect, Rival Mining Crew.
- Contracts themed to the sector's traits/anomalies; rival crews offer competitive "race" contracts.
- Local standing is lost on jump; **maxing it grants a persistent Sector Legacy reward**.

### Mechanics
- Types: Delivery, Refinement, Bounty, Survey, Blitz, Sustain, Escort.
- Board: 3 offers, timed refresh, paid reroll. **Active contracts 1 → 3.**
- Targets scale with production and depth. **Reserve for Contract** toggle protects ore from Auto-Sell.
- **Deadlines pause while offline.** Failure costs only a little standing.
- Rewards: premium credits, Survey Data, Data Cores, corp-specific items; standing tiers give permanent perks and an exclusive item.
- Merchant favors and story objectives appear on the same board.
- UI: teletype/fax printouts with corporate logos and a stamp-on-accept animation.

---

## 8. Prestige — the Fold Jump *(Decided)*

- **In-fiction:** the Fold Drive's field covers only the **core hull**. Drones, mechs, refinery modules and cargo are left behind (as a beacon station); credits don't work across sectors. The core keeps the **Jump Core** (memory/tuning), **pilots**, **blueprints**, the **Vault**.
- **Charging:** feed high-tier ore/ingots to charge 0 → 100%; **over-charge** for bonus rewards.
- **Fold Resonance:** earned per jump (≈ √ lifetime credits this run, plus over-charge). Passive +2% production per point; spent in the **Jump Core upgrade tree** (start with drones, Research Archive slots, offline efficiency/cap, starting drill tier, Long-Range Sensors, stronger Overdrive, hangar bays, Crew Quarters…).

| Resets | Persists |
|---|---|
| Credits, ore, ingots | Fold Resonance, Jump Core upgrades |
| Drones, refinery, cargo upgrades | Pilots (with levels) |
| Mechs (rebuilt cheaply from blueprints) | Blueprints, Vault parts |
| Survey zones, contracts, local standing | Corp standing, merchant reputation |
| Research (except archived / permanent QoL) | Codex, commendations, stats, story progress |

- **Jump sequence:** klaxon "FOLD DRIVE ARMED — ALL HANDS TO CORE" → fleet farewell formation → countdown → warp tunnel → white flash → **EPISODE N** title card → arrival.

---

## 9. Story — episodes *(Decided)*

- **26 episodes in 3 acts**, milestone-triggered, persist across jumps, **never block progress** (queued). Then endless procedural **side episodes**.
- Each: title card, short visual-novel scene (portraits + dialogue), mid-run eyecatch, "Next episode…" teaser after jumps. Skippable; replay in the Archive.

### Cast *(names placeholder)*
- **Juno Hart** — starting pilot; hot-blooded ex-racer. (Ep 1)
- **Kit Okafor** — cheerful engineer, comic relief. (Act 1)
- **Saffi Lin** — stoic ace, ex-Meridian test pilot. (Act 2)
- **Brother Ansel** — Grey Tithe scholar, reads the Silent Beacons. (Act 2)
- **VESPER** — ship AI; dry, precise; voice of research/system messages (not a pilot).
- **The Vermilion Jackal** — Pirate Ace rival.
- **Director Hale** — Meridian liaison.

### Plot
- **Act 1 "Frontier" (Ep 1–8):** frontier prospecting; Kit joins; Jackal's first raid; first beacon fragment; first Fold Jump (Ep 8) with an impossible VESPER reading.
- **Act 2 "Signal" (Ep 9–17):** beacons are fold navigation markers **addressed to your ship by name**; Saffi reveals earlier Meridian fold ships never returned; the Jackal was a pilot of one and is trying to stop you; Hale's requests get strange.
- **Act 3 "Fold" (Ep 18–26):** **time-loop twist** — each jump loops the ship through a recursion; the beacons are messages from **earlier versions of your crew**; pilots are the "anchors" that carry over; Meridian harvests Fold Resonance from the cycle.

### Finale — permanent, meaningful branch
| | Break the Cycle | Master the Cycle |
|---|---|---|
| Story | Rebuild the drive with the Jackal; jumps become true travel | Seize Meridian's resonance harvest |
| Prestige | Gentler resets (keep some drones/research), lower Resonance | Much higher Resonance + new **Deep Fold** prestige layer |
| Pirates | Jackal becomes an ally; Heat builds at half rate; pirate black market | Jackal stays an enemy, stronger |
| Corps | Meridian hostile (no contracts, corporate raids) | Meridian serves you (exclusive contracts/perks) |
| Presentation | Bright jumps, dawn title screen | Dark recursive jumps, dark title screen |

**The choice is permanent for the save.**

---

## 10. Meta & systems *(Decided)*

- **One save per browser.** localStorage, versioned schema + migrations, autosave every 30 s and on tab hide/close, **3 rolling backups**, export/import as compressed string or file.
- **Commendations:** ~80 ribbon/medal achievements across Mining, Fleet, Pilots, Exploration, Combat, Commerce, Story, Secret; each grants a **small permanent bonus**.
- **Records:** lifetime + per-run stats; **Sector Logbook** of every visited sector; **Archive** (codex, episode replays, dossiers incl. dismissed pilots, lore, merchant/corp records).
- **Settings:** audio (music / SFX / comm bleeps), CRT overlay, screen shake, reduced motion, cut-in frequency, number format (suffix / scientific / engineering), autosave interval, confirmations, default Standing Orders.
- **Notifications:** tab-title flashing for urgent events; **opt-in** browser notifications.
- **Accessibility:** alerts use text + shape (not only color), colorblind-checked palette, keyboard navigation and hotkeys, UI scale.
- No backend, no analytics. Hidden tab → throttled loop with elapsed-time catch-up.

---

## 11. Presentation *(Decided)*

- **Art direction:** 80s/early-90s cel animation — hard two-tone shading, airbrushed highlights, film grain, faint chromatic aberration.
- **Palette:** deep space navy/black; sunset magenta/orange; cockpit amber/cyan readouts; red/yellow hazard stripes.
- **Fonts** *(good for now, may revisit)*: Russo One / Audiowide (display), Share Tech Mono / VT323 (readouts), DotGothic16 (katakana).
- **Layout (desktop-first):** status bar (credits, ores, Survey Data, Fold charge, Pirate Heat) / left nav (Ops, Hangar, Crew, Lab, Map, Board) / central viewport + active panel / right comm log + contract tracker / bottom market ticker. Bezels, rivets, LEDs, chunky buttons. **Mobile works but isn't polished.**
- **Viewport:** procedural cel-shaded asteroid with progressive cracks and debris particles, mech drill beams, orbiting drones, sector-specific star/backdrop, floating "+12 TTN" numbers.
- **Set pieces:** title screen, mech launch, full-screen technique cut-ins, warning alerts, Fold Jump, eyecatch, teletype welcome-back report. Reduced motion → fades.
- **Art production:** **code-drawn layered SVG/CSS** first; asset folders (`public/assets/portraits`, `mechs`, …) let hand-drawn art replace layers later.
- **Audio:** **music and SFX generated in code** (Web Audio) — original synth soundtrack, drill whirs, UI beeps, klaxon, launch whoosh, comm voice bleeps.

### Title screen (landing page)
- Starfield parallax, striped retro sun, scrolling neon perspective grid, chrome **FOLD DRIVE MINER** logo with glint + katakana subtitle, mining-mech silhouette whose eyes light up, optional CRT overlay.
- First visit: skippable terminal boot sequence. **PRESS START** (also unlocks audio). Menu: Continue (save card: sector, depth, credits, Resonance, playtime, last saved) / New Game (overwrite confirm → name Commander and ship → Episode 1 card) / Import-Export / Settings / Credits.
- A view state inside the single page, not a separate route.

---

## 12. Technical architecture

- Angular 22 standalone components, **signals** for state; one root `GameStateService` (plus feature services) with computed signals for derived values.
- Logic tick at **10 Hz**, decoupled from rendering (`requestAnimationFrame` for visuals); the same tick function runs offline catch-up in large steps.
- **All tuning numbers in config files** (no balancing in code).
- Plain JS numbers; display with suffixes up to ~1e15, then scientific.
- Seeded RNG for sectors, merchants, outfits, pilots.
- Tabs as in-app view state (no route changes during play).

---

## 13. Milestones (proposed)

> **Done:** M1 and M2. M2 implementation choices: ingots don't use cargo space; a refinery batch is 25% of cargo capacity; refinery upgrades come only from research; Drill Mk.II is bought with credits while Mk.III/IV are researched; research and the refinery run at full speed offline (only drones are reduced); home-sector zones are fixed (Inner Belt, Trojan Cluster, Ring Debris, Ice Halo) until sector generation in M5.

1. **M1 — Playable core:** title screen, HUD shell, asteroid clicking + heat/Overdrive, Ferrite/Titanite, cargo, selling + market drift, drill upgrades, Mk.I drones, number formatting, save/autosave/offline report, basic code-generated SFX.
2. **M2 — Economy depth:** refinery, research (Survey Data, lab slots), Iridium/Helium-3, Auto-Sell/Auto-Refine, survey zones.
3. **M3 — Fleet & crew:** drone types, mechs, loadouts + power budget, repair bay, pilots, station posts.
4. **M4 — Threats:** events, Standing Orders, automatic sorties, Pirate Heat, Jackal encounters.
5. **M5 — Living sectors:** sector generation, anomalies, merchant fleets, contracts, local outfits.
6. **M6 — Fold Jump:** Fold Drive charging, Resonance, Jump Core tree, destination choice, jump sequence.
7. **M7 — Story & meta:** episodes, Archive/codex, commendations, Sector Logbook.
8. **M8 — Polish:** cut-ins, generated music, CRT/film effects, accessibility pass, balancing.

---

## Open questions (Core loop, §1)
These were proposed and are used by later sections, but not yet explicitly confirmed:
1. Keep **drill heat / Overdrive**?
2. Keep the **cargo capacity limit**?
3. Keep **market price drift**?
4. Keep placeholder **ore names**?
5. Offline **50% efficiency / 8 h cap** as a starting point?
