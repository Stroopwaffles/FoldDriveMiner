/**
 * Story content: the 26 episodes in three acts, side stories after the finale
 * and the finale's two branches. Text uses {ship} and {cmdr} placeholders.
 */
import { drillTier } from './common';
import { GameState } from './types';

export type StoryVoice = 'VESPER' | 'JUNO' | 'KIT' | 'SAFFI' | 'ANSEL' | 'HALE' | 'JACKAL' | 'SYSTEM';
export type FinaleChoice = 'break' | 'master';
export type Line = [StoryVoice, string];

export interface EpisodeDef {
  n: number;
  act: 1 | 2 | 3;
  title: string;
  /** What has to happen for the episode to arrive (shown as a hint in the Archive). */
  hint: string;
  trigger: (s: GameState) => boolean;
  lines: Line[];
  /** A story pilot who joins the roster when the episode arrives. */
  joins?: 'saffi' | 'ansel';
}

/** The animated backdrop behind a story scene. */
export type SceneSetting = 'bridge' | 'belt' | 'hangar' | 'battle' | 'beacon' | 'fold' | 'wrecks' | 'station' | 'nebula' | 'void';

/** Backdrop per episode, by episode number (index 0 unused). */
export const EPISODE_SETTINGS: readonly SceneSetting[] = [
  'bridge',
  'bridge', 'belt', 'belt', 'hangar', 'hangar', 'battle', 'beacon', 'fold', // Act I
  'beacon', 'battle', 'wrecks', 'nebula', 'battle', 'station', 'fold', 'beacon', 'bridge', // Act II
  'void', 'hangar', 'nebula', 'void', 'battle', 'void', 'fold', 'void', 'fold', // Act III
];

/** Backdrop per side story, by number (index 0 unused). */
export const SIDE_SETTINGS: readonly SceneSetting[] = ['nebula', 'station', 'hangar', 'beacon', 'bridge', 'battle', 'hangar'];

export function sceneSetting(kind: 'episode' | 'side', n: number): SceneSetting {
  return (kind === 'episode' ? EPISODE_SETTINGS[n] : SIDE_SETTINGS[n]) ?? 'nebula';
}

export const ACTS = ['', 'Act I · Frontier', 'Act II · Signal', 'Act III · Fold'] as const;

/**
 * Episode pacing: one at a time. The next arrives only once the last is
 * watched, its milestone is met, and there's been a new story beat since the
 * last one arrived: a Fold Jump, or this much playtime.
 */
export const STORY = { minGapSec: 600 };

const codexKinds = (s: GameState) => Object.keys(s.anomalies.codex).length;
const runCredits = (s: GameState) => s.stats.creditsEarned - s.fold.runStartCredits;
const maxLevel = (s: GameState) => Math.max(0, ...s.pilots.map((p) => p.level));

export const EPISODES: readonly EpisodeDef[] = [
  // ------------------------------------------------------------ Act I · Frontier
  {
    n: 1, act: 1, title: 'Frontier Contract', hint: 'Start a new game.', trigger: () => true,
    lines: [
      ['VESPER', 'Fold-class command vessel {ship} on station. Frontier contract confirmed: mine, sell, survive.'],
      ['JUNO', 'So this is the frontier? Rocks. Lots and lots of rocks.'],
      ['VESPER', 'Correct. Rocks are the business model, Ms. Hart.'],
      ['JUNO', "Then let's get drilling, Commander {cmdr}!"],
    ],
  },
  {
    n: 2, act: 1, title: 'Drones in the Dark', hint: 'Deploy your first drone.', trigger: (s) => s.drones.prospector > 0,
    lines: [
      ['VESPER', 'Prospector drone away. It will keep mining while you sleep, Commander.'],
      ['JUNO', 'Little guy looks lonely out there.'],
      ['VESPER', 'It is a drone. It does not get lonely.'],
      ['JUNO', '...Buy it some friends anyway.'],
    ],
  },
  {
    n: 3, act: 1, title: 'Blue Glint', hint: 'Refit to a Drill Mk.II.', trigger: (s) => drillTier(s) >= 2,
    lines: [
      ['JUNO', 'See that blue? Titanite. Back on the racing circuit we used to coat engine bells with it.'],
      ['VESPER', 'Titanite sells for eight times the price of Ferrite. I recommend not coating anything with it.'],
      ['JUNO', 'Spoilsport.'],
    ],
  },
  {
    n: 4, act: 1, title: 'Hangar Lights', hint: 'Build your first mech.', trigger: (s) => s.stats.mechsBuilt > 0,
    lines: [
      ['VESPER', 'Mech frame assembled. Pilot interface awaiting a handshake.'],
      ['JUNO', "Finally! I haven't sat in a real cockpit since they pulled my racing license."],
      ['JUNO', "Don't ask why. ...It involved a moon."],
      ['VESPER', 'Logged.'],
    ],
  },
  {
    n: 5, act: 1, title: 'Wrench in the Works', hint: 'Bring an engineer aboard (Repair Bay).', trigger: (s) => s.pilots.some((p) => p.story === 'kit'),
    lines: [
      ['KIT', "Hi! Kit Okafor. Engineer, repair bay, reluctant tea expert. Who welded this hangar door? It's beautiful. It's also upside down."],
      ['JUNO', 'That was me.'],
      ['KIT', "It's still beautiful!"],
      ['VESPER', 'Repair Bay online. Morale indicators... elevated.'],
    ],
  },
  {
    n: 6, act: 1, title: 'Red on the Scope', hint: 'Face your first pirate raid.', trigger: (s) => s.threats.raids > 0,
    lines: [
      ['VESPER', 'Unregistered frames on approach. Pirate transponders, spoofed as Meridian survey craft.'],
      ['JUNO', 'Pirates? Out here? We barely have anything worth stealing.'],
      ['KIT', 'We have a LOT worth stealing. I just catalogued it.'],
      ['VESPER', 'Set Standing Orders in DEFENSE, Commander. They will be back.'],
    ],
  },
  {
    n: 7, act: 1, title: 'Voice in the Static', hint: 'Decode a Silent Beacon fragment.', trigger: (s) => s.anomalies.lore >= 1,
    lines: [
      ['VESPER', "The beacon's first fragment is decoded. Its carrier wave predates human shipping lanes by four centuries."],
      ['JUNO', "So it's old."],
      ['VESPER', 'It is old, and it uses a navigation protocol that was invented eleven years ago.'],
      ['KIT', "That's... not how time works, right? Somebody tell me that's not how time works."],
    ],
  },
  {
    n: 8, act: 1, title: 'Minus Four Seconds', hint: 'Make your first Fold Jump.', trigger: (s) => s.fold.jumps >= 1,
    lines: [
      ['VESPER', 'Fold complete. All hands accounted for.'],
      ['VESPER', 'Commander, my chronometer logged the jump as taking minus four seconds.'],
      ['JUNO', 'So we arrived before we left? Neat.'],
      ['VESPER', 'It is not neat. It is not possible.'],
      ['KIT', "I'm going to go lie down in the reactor room. It's quiet there."],
    ],
  },
  // ------------------------------------------------------------ Act II · Signal
  {
    n: 9, act: 2, title: 'Addressed by Name', hint: 'Decode three beacon fragments.', trigger: (s) => s.anomalies.lore >= 3,
    lines: [
      ['VESPER', 'Fragment three is a header. A routing address.'],
      ['VESPER', "It reads: 'To the {ship}, from the {ship}.'"],
      ['JUNO', "That's a prank. Someone with a sense of humour and a really big antenna."],
      ['VESPER', 'The signature is mine, Ms. Hart. My voiceprint. My error-correction habits.'],
      ['KIT', 'VESPER has habits?'],
      ['VESPER', 'Everyone has habits.'],
    ],
  },
  {
    n: 10, act: 2, title: 'Test Pilot', hint: 'Win three raids after your first jump.', joins: 'saffi',
    trigger: (s) => s.fold.jumps >= 1 && s.threats.raidsWon >= 3,
    lines: [
      ['SAFFI', 'Saffi Lin. Ex-Meridian test program. I heard you had a fold drive and nobody telling you what it does.'],
      ['JUNO', 'And you know what it does?'],
      ['SAFFI', 'I know what it did to the last seven ships that had one.'],
      ['SAFFI', "I'd like to be aboard when it does it to this one."],
      ['VESPER', 'Saffi Lin has joined the roster.'],
    ],
  },
  {
    n: 11, act: 2, title: 'Ghost Ships', hint: 'Earn 1M credits in a single run.', trigger: (s) => s.fold.jumps >= 1 && runCredits(s) >= 1e6,
    lines: [
      ['SAFFI', 'Meridian built seven fold hulls before yours. Halcyon class.'],
      ['KIT', 'Built? Past tense?'],
      ['SAFFI', "They jumped. None came back. The company filed them as 'ongoing survey.'"],
      ['JUNO', 'For how long?'],
      ['SAFFI', 'Thirty years.'],
      ['VESPER', '...I have checked the registry. The {ship} is listed as hull number eight.'],
    ],
  },
  {
    n: 12, act: 2, title: 'The Grey Scholar', hint: 'Identify five kinds of anomaly.', joins: 'ansel', trigger: (s) => codexKinds(s) >= 5,
    lines: [
      ['ANSEL', "Brother Ansel, of the Grey Tithe. We read the old signals so others don't have to."],
      ['ANSEL', 'Your beacons are not warnings, Commander. They are directions.'],
      ['KIT', 'Directions to where?'],
      ['ANSEL', 'To here. To you. Over and over.'],
      ['VESPER', 'Brother Ansel has joined the roster. He has asked for a desk near the comms array.'],
    ],
  },
  {
    n: 13, act: 2, title: "The Jackal's Face", hint: 'Meet the Vermilion Jackal three times.', trigger: (s) => s.threats.jackalEncounters >= 3,
    lines: [
      ['JACKAL', "You're getting good, {ship}. Good enough to keep jumping. That's the problem."],
      ['JUNO', 'Who ARE you?'],
      ['JACKAL', 'Hull six. Halcyon class. I was the last one to come back.'],
      ['SAFFI', "...Commander. That's Rei Vashti's frame. She was my instructor."],
      ['JACKAL', "Stop jumping, little bird. Or don't. I've watched you choose before."],
    ],
  },
  {
    n: 14, act: 2, title: "Hale's Request", hint: 'Reach standing 5 with Meridian.', trigger: (s) => (s.contracts.standing.meridian ?? 0) >= 5,
    lines: [
      ['HALE', 'Commander. Director Hale, Meridian Heavy Industries. Your numbers are wonderful.'],
      ['HALE', "We'd like you to keep jumping. We'll make it worth your while."],
      ['SAFFI', "He's not asking about your ore."],
      ['HALE', "Ms. Lin. I'd heard you left us. And yet here you are, on hull eight."],
      ['HALE', 'Funny how everyone ends up aboard.'],
    ],
  },
  {
    n: 15, act: 2, title: 'Second Fold', hint: 'Make a second Fold Jump.', trigger: (s) => s.fold.jumps >= 2,
    lines: [
      ['VESPER', 'Second fold complete. Chronometer delta: minus nine seconds.'],
      ['KIT', "It's getting worse."],
      ['VESPER', "It is getting larger. 'Worse' is a value judgement."],
      ['ANSEL', 'The beacons in this sector have fragments decoded already. By someone.'],
      ['JUNO', 'By who?'],
      ['ANSEL', 'By us.'],
    ],
  },
  {
    n: 16, act: 2, title: 'Drift Logs', hint: 'Decode a Silent Beacon completely.', trigger: (s) => s.anomalies.lore >= 5,
    lines: [
      ['VESPER', 'Beacon decode complete. The final fragment is a flight log.'],
      ['VESPER', 'Pilot roster: Hart, Okafor, Lin, Ansel. Command: {cmdr}.'],
      ['JUNO', "That's us. That's literally us."],
      ['VESPER', 'The log is dated forty-one cycles ago.'],
      ['KIT', 'Cycles of what?'],
      ['ANSEL', 'Of this.'],
    ],
  },
  {
    n: 17, act: 2, title: 'Recall Order', hint: 'Make a third Fold Jump.', trigger: (s) => s.fold.jumps >= 3,
    lines: [
      ['HALE', 'Commander, Meridian is issuing a recall for hull eight. Please return to the home reach.'],
      ['SAFFI', 'They never recall. They never recalled anyone.'],
      ['HALE', "We're recalling you, Ms. Lin, because you've gone further than the others."],
      ['HALE', 'And further is where the yield is.'],
      ['VESPER', 'The recall order contains a fold vector. It does not lead home.'],
    ],
  },
  // ------------------------------------------------------------ Act III · Fold
  {
    n: 18, act: 3, title: 'Recursion', hint: 'Earn 50 lifetime Fold Resonance.', trigger: (s) => s.fold.lifetimeResonance >= 50,
    lines: [
      ['VESPER', 'I have finished the analysis. The Fold Drive does not move us through space.'],
      ['VESPER', 'It folds us back through ourselves. Each jump, the universe resets around the core hull.'],
      ['JUNO', 'And everything we leave behind?'],
      ['VESPER', 'Is still there. In a cycle we no longer occupy.'],
      ['KIT', 'So every drone we ever built...'],
      ['VESPER', 'Is mining in a sector that has already ended. Yes.'],
    ],
  },
  {
    n: 19, act: 3, title: 'Anchors', hint: 'Raise a pilot to level 20.', trigger: (s) => maxLevel(s) >= 20,
    lines: [
      ['ANSEL', "Have you noticed the crew never forgets? Ships reset. Ledgers reset. We don't."],
      ['SAFFI', 'Pilots are anchors. That is what the test program called us. I thought it was a metaphor.'],
      ['VESPER', 'It is a specification. The drive needs stable observers to fold around.'],
      ['JUNO', "So we're the reason it works."],
      ['ANSEL', "We're the reason it keeps working."],
    ],
  },
  {
    n: 20, act: 3, title: 'Messages Home', hint: 'Make a fourth Fold Jump.', trigger: (s) => s.fold.jumps >= 4,
    lines: [
      ['VESPER', 'I am composing a beacon, Commander.'],
      ['VESPER', 'If the cycle holds, an earlier version of this ship will find it in their first sector.'],
      ['KIT', 'What are you telling them?'],
      ['VESPER', 'What they told us. That they are not alone. That it matters what they choose.'],
      ['JUNO', "Put in something about the coffee stain. They'll know it's real."],
    ],
  },
  {
    n: 21, act: 3, title: 'The Harvest', hint: 'Earn 150 lifetime Fold Resonance.', trigger: (s) => s.fold.lifetimeResonance >= 150,
    lines: [
      ['SAFFI', "I got into Meridian's ledgers. Fold Resonance, the thing we bank every jump..."],
      ['SAFFI', "It leaks. Every loop. Meridian has collectors on every relay we've ever passed."],
      ['HALE', "Ms. Lin, that's proprietary."],
      ['HALE', 'Your ship is the most profitable thing my company has ever built. Please don’t stop.'],
    ],
  },
  {
    n: 22, act: 3, title: "The Jackal's Offer", hint: 'Defeat the Jackal three times, or strike the pirate base twice.',
    trigger: (s) => s.threats.jackalDefeats >= 3 || s.threats.strikesWon >= 2,
    lines: [
      ['JACKAL', 'You beat me again. You always do, around now.'],
      ['JACKAL', 'I broke my drive to get out. Took me a hundred loops to learn how.'],
      ['JACKAL', 'Rebuild yours with me, and the jumps become real travel. One way. No more loop.'],
      ['SAFFI', '...Rei.'],
      ['JACKAL', 'Hello, Saffi. You were always the better pilot.'],
    ],
  },
  {
    n: 23, act: 3, title: 'Deep Water', hint: 'Reach sector depth 5.', trigger: (s) => s.sector.depth >= 5,
    lines: [
      ['VESPER', 'Depth five. The sector charts here are... handwritten.'],
      ['ANSEL', 'Annotated. By us. In my handwriting.'],
      ['KIT', "Okay, I'm officially scared."],
      ['JUNO', "We go deeper, we get stronger. That's how it's always worked, right?"],
      ['VESPER', 'That is how it has always worked. That is the problem.'],
    ],
  },
  {
    n: 24, act: 3, title: "Saffi's Flight", hint: 'Make a fifth Fold Jump.', trigger: (s) => s.fold.jumps >= 5,
    lines: [
      ['SAFFI', 'Permission to fly the next fold vector solo, Commander. Just past the field edge.'],
      ['SAFFI', "If I can see the loop from outside, I'll know which way out is real."],
      ['JUNO', "And if you can't come back?"],
      ['SAFFI', "Then I'll be the beacon. Somebody has to be."],
      ['VESPER', '...She returned four seconds before she left. She has seen it, Commander.'],
    ],
  },
  {
    n: 25, act: 3, title: 'Last Light', hint: 'Earn 300 lifetime Fold Resonance.', trigger: (s) => s.fold.lifetimeResonance >= 300,
    lines: [
      ['SAFFI', "There are two doors out. The Jackal's way: break the drive, end the loop, and the jumps become honest."],
      ['HALE', "Or Meridian's way. Take the harvest. Own the cycle. Every loop richer than the last."],
      ['ANSEL', 'Whatever you choose, Commander, you choose it for every version of us.'],
      ['KIT', 'No pressure.'],
      ['JUNO', "We're with you. Whichever door."],
    ],
  },
  {
    n: 26, act: 3, title: 'The Cycle', hint: 'Make a sixth Fold Jump.', trigger: (s) => s.fold.jumps >= 6,
    lines: [
      ['VESPER', 'Fold Drive at the threshold. The cycle is listening, Commander.'],
      ['JACKAL', 'Break it with me. Let them all go home.'],
      ['HALE', 'Master it with us. Let nothing go to waste.'],
      ['VESPER', 'The choice is permanent. I will remember it. So will every one of us.'],
    ],
  },
];

export const FINAL_EPISODE = EPISODES.length;

export function episodeDef(n: number): EpisodeDef | undefined {
  return EPISODES[n - 1];
}

// ---------------------------------------------------------------- the finale

export interface FinaleDef {
  id: FinaleChoice;
  name: string;
  kana: string;
  pitch: string;
  effects: string[];
  aftermath: Line[];
}

export const FINALE: Record<FinaleChoice, FinaleDef> = {
  break: {
    id: 'break',
    name: 'Break the Cycle',
    kana: 'ループをこわせ',
    pitch: 'Rebuild the drive with the Jackal. Jumps become true travel.',
    effects: [
      'Gentler jumps: keep 10% of your drones and 2 extra Research Archive slots',
      'Fold Resonance ×0.75',
      'The Jackal is an ally: no more Jackal raids, Pirate Heat builds at half rate',
      "The Lantern Market's black market trades in every sector",
      'Meridian turns hostile: no Meridian contracts',
    ],
    aftermath: [
      ['JACKAL', 'Then we fly together, {ship}. For real this time.'],
      ['VESPER', 'Fold Drive reconfigured. Chronometer delta: zero. Meridian has cancelled our contracts.'],
      ['JUNO', 'Good riddance. Dawn looks better from out here anyway.'],
    ],
  },
  master: {
    id: 'master',
    name: 'Master the Cycle',
    kana: 'ループをせいせよ',
    pitch: "Seize Meridian's resonance harvest. Every loop richer than the last.",
    effects: [
      'Fold Resonance ×1.5',
      'Meridian serves you: Meridian contracts pay 50% more',
      'The Jackal stays an enemy and comes back 50% stronger',
    ],
    aftermath: [
      ['HALE', 'Excellent. Meridian Heavy Industries is at your service, Commander.'],
      ['JACKAL', "Then I'll see you next loop. And the one after that."],
      ['VESPER', 'Resonance harvest online. The jumps will be... darker now.'],
    ],
  },
};

// ---------------------------------------------------------------- side stories (after the finale)

export const SIDE_STORIES: readonly { title: string; lines: Line[] }[] = [
  {
    title: 'Shore Leave',
    lines: [
      ['JUNO', 'Commander, the crew voted. We want a day off.'],
      ['VESPER', 'There are no days in a fold cycle, Ms. Hart.'],
      ['KIT', "Then we'll take a loop off. I've packed snacks."],
    ],
  },
  {
    title: 'Night Shift',
    lines: [
      ['ANSEL', 'The drones hum differently at night. A lower note.'],
      ['VESPER', 'There is no night in space, Brother.'],
      ['ANSEL', 'And yet they hum lower. Listen.'],
    ],
  },
  {
    title: 'Old Frequencies',
    lines: [
      ['SAFFI', "I found the test program's radio band. Somebody's still broadcasting on it."],
      ['SAFFI', "It's music. Bad music. My old squadron's."],
      ['JUNO', 'Turn it up.'],
    ],
  },
  {
    title: 'Card Night',
    lines: [
      ['KIT', 'Rule one of Fold Poker: VESPER does not play.'],
      ['VESPER', 'I would win every hand.'],
      ['KIT', 'That is why rule one exists.'],
    ],
  },
  {
    title: 'Pirate Radio',
    lines: [
      ['JACKAL', "Little bird. You still awake? Can't sleep either, in a loop."],
      ['SAFFI', 'Go to sleep, Rei.'],
      ['JACKAL', 'Make me.'],
    ],
  },
  {
    title: 'Inventory Day',
    lines: [
      ['VESPER', 'Annual inventory. We own four thousand bolts and one rubber duck.'],
      ['KIT', 'The duck stays.'],
      ['JUNO', 'The duck ALWAYS stays.'],
    ],
  },
];
