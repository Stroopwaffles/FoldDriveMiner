/**
 * Research tree definitions. Costs and times are tuning data; effects are
 * read by the engine through researchLevel().
 */

export type Branch = 'extraction' | 'logistics' | 'refinery' | 'survey' | 'station' | 'fleet' | 'fold';

export const BRANCHES: { id: Branch; name: string; kana: string; color: string }[] = [
  { id: 'extraction', name: 'Extraction', kana: 'さいくつ', color: '#ff7a3d' },
  { id: 'logistics', name: 'Logistics', kana: 'ぶつりゅう', color: '#ffd23f' },
  { id: 'refinery', name: 'Refinery', kana: 'せいれん', color: '#ff3d9a' },
  { id: 'survey', name: 'Sensors & Survey', kana: 'たんさ', color: '#4fe3ff' },
  { id: 'station', name: 'Station', kana: 'ステーション', color: '#6dff9b' },
  { id: 'fleet', name: 'Fleet Engineering', kana: 'かんたい', color: '#8d95c7' },
  { id: 'fold', name: 'Fold Science', kana: 'フォールド', color: '#c77dff' },
];

export interface ResearchNode {
  id: string;
  name: string;
  branch: Branch;
  maxLevel: number;
  /** Survey Data, credits and seconds for level 1; later levels multiply by growth^level. */
  sd: number;
  cr: number;
  sec: number;
  growth: number;
  /** Nodes that must be at least level 1. */
  requires: string[];
  /** Minimum drill tier needed to start. */
  requiresTier?: number;
  /** Short effect text shown on the node. */
  effect: string;
  /** Flavor line from VESPER. */
  flavor: string;
  /** Visible but not researchable yet; names the milestone that adds it. */
  teaser?: string;
}

const N = (n: Omit<ResearchNode, 'growth' | 'requires'> & Partial<Pick<ResearchNode, 'growth' | 'requires'>>): ResearchNode => ({
  growth: 1,
  requires: [],
  ...n,
});

export const RESEARCH: readonly ResearchNode[] = [
  // ---------------------------------------------------------------- Extraction
  N({
    id: 'depletion_bonus', name: 'Fracture Mapping', branch: 'extraction', maxLevel: 5,
    sd: 4, cr: 800, sec: 60, growth: 2.2,
    effect: '+25% bonus ore when an asteroid cracks',
    flavor: 'Strike the fault lines and the rock gives up its heart.',
  }),
  N({
    id: 'overdrive_tuning', name: 'Overdrive Tuning', branch: 'extraction', maxLevel: 3,
    sd: 6, cr: 2500, sec: 90, growth: 2.5,
    effect: '+0.5× Overdrive multiplier',
    flavor: 'Pilot Hart requests "more red." Interpreting as a power curve adjustment.',
  }),
  N({
    id: 'drill_mk3', name: 'Drill Mk.III', branch: 'extraction', maxLevel: 1,
    sd: 12, cr: 12000, sec: 180, requires: ['survey_trojan'], requiresTier: 2,
    effect: 'Drill can cut Iridium (60 cr base)',
    flavor: 'Diamond-lattice cutting head. Iridium will no longer be slag.',
  }),
  N({
    id: 'cryo_hold', name: 'Cryo Hold', branch: 'extraction', maxLevel: 1,
    sd: 40, cr: 250000, sec: 600, requires: ['drill_mk3', 'survey_ice'],
    effect: 'Insulated storage for Helium-3',
    flavor: 'Helium-3 must be kept at 3 kelvin. The hold will be colder than space.',
  }),
  N({
    id: 'drill_mk4', name: 'Drill Mk.IV', branch: 'extraction', maxLevel: 1,
    sd: 80, cr: 1500000, sec: 1200, requires: ['cryo_hold'], requiresTier: 3,
    effect: 'Drill can extract Helium-3 (450 cr base)',
    flavor: 'Thermal lance and capture field. Helium-3 extraction ready.',
  }),

  // ---------------------------------------------------------------- Logistics
  N({
    id: 'cargo_compression', name: 'Cargo Compression', branch: 'logistics', maxLevel: 5,
    sd: 3, cr: 600, sec: 60, growth: 2.4,
    effect: '+25% cargo capacity',
    flavor: 'Same hold, tighter packing. Kit says it is "basically Tetris."',
  }),
  N({
    id: 'auto_sell', name: 'Auto-Sell', branch: 'logistics', maxLevel: 1,
    sd: 8, cr: 3000, sec: 120, requires: ['cargo_compression'],
    effect: 'Sell chosen ores and ingots automatically',
    flavor: 'Standing sell orders with the sector exchange. No more manual haggling.',
  }),
  N({
    id: 'market_analysis', name: 'Market Analysis', branch: 'logistics', maxLevel: 1,
    sd: 15, cr: 20000, sec: 300, requires: ['auto_sell'],
    effect: 'Price forecasts + Smart Sell (auto-sell only above average)',
    flavor: 'The exchange is predictable if you are patient. I am very patient.',
  }),
  N({
    id: 'fleet_dispatch', name: 'Fleet Dispatch', branch: 'logistics', maxLevel: 1,
    sd: 0, cr: 0, sec: 0, teaser: 'Milestone 3',
    effect: 'Split drones across survey zones',
    flavor: 'Requires a larger fleet.',
  }),

  // ---------------------------------------------------------------- Refinery
  N({
    id: 'refinery', name: 'Ore Refinery', branch: 'refinery', maxLevel: 1,
    sd: 4, cr: 400, sec: 45,
    effect: 'Turn ore into ingots worth 40% more',
    flavor: 'A smelter module bolted to the keel. Raw ore in, ingots out.',
  }),
  N({
    id: 'refinery_speed', name: 'Furnace Pressure', branch: 'refinery', maxLevel: 5,
    sd: 5, cr: 1500, sec: 90, growth: 2.2, requires: ['refinery'],
    effect: '−15% batch time',
    flavor: 'Hotter, faster, louder.',
  }),
  N({
    id: 'refinery_yield', name: 'Slag Recovery', branch: 'refinery', maxLevel: 3,
    sd: 10, cr: 6000, sec: 180, growth: 2.8, requires: ['refinery'],
    effect: '1 fewer ore per ingot',
    flavor: 'What we threw away was still worth something.',
  }),
  N({
    id: 'refinery_slots', name: 'Parallel Furnaces', branch: 'refinery', maxLevel: 2,
    sd: 12, cr: 10000, sec: 240, growth: 4, requires: ['refinery_speed'],
    effect: '+1 refinery slot',
    flavor: 'A second furnace. Then a third.',
  }),
  N({
    id: 'auto_refine', name: 'Auto-Refine', branch: 'refinery', maxLevel: 1,
    sd: 20, cr: 25000, sec: 360, requires: ['refinery_slots'],
    effect: 'Slots can repeat batches automatically',
    flavor: 'The furnaces will feed themselves.',
  }),
  N({
    id: 'alloys', name: 'Alloy Smelting', branch: 'refinery', maxLevel: 1,
    sd: 0, cr: 0, sec: 0, teaser: 'a later milestone',
    effect: 'Combine two ores into high-value alloys',
    flavor: 'Metallurgy data incomplete.',
  }),

  // ---------------------------------------------------------------- Survey
  N({
    id: 'core_sampling', name: 'Core Sampling', branch: 'survey', maxLevel: 5,
    sd: 5, cr: 2000, sec: 90, growth: 2.3,
    effect: '+50% Survey Data from cracked asteroids',
    flavor: 'Every rock is a library. We are learning to read faster.',
  }),
  N({
    id: 'survey_trojan', name: 'Survey: Trojan Cluster', branch: 'survey', maxLevel: 1,
    sd: 6, cr: 1500, sec: 120,
    effect: 'Unlock the Trojan Cluster zone',
    flavor: 'Gravitational anomaly at the L4 point. Worth a look.',
  }),
  N({
    id: 'survey_ring', name: 'Survey: Ring Debris', branch: 'survey', maxLevel: 1,
    sd: 25, cr: 60000, sec: 420, requires: ['survey_trojan', 'drill_mk3'],
    effect: 'Unlock the Ring Debris zone',
    flavor: 'Iridium signatures across the ring plane. Plotting a safe approach.',
  }),
  N({
    id: 'survey_ice', name: 'Survey: Ice Halo', branch: 'survey', maxLevel: 1,
    sd: 60, cr: 600000, sec: 900, requires: ['survey_ring'],
    effect: 'Unlock the Ice Halo zone',
    flavor: 'Helium-3 detected in the outer ice. Cold, slow, and very valuable.',
  }),

  // ---------------------------------------------------------------- Station
  N({
    id: 'lab_slot_2', name: 'Second Lab Bench', branch: 'station', maxLevel: 1,
    sd: 10, cr: 5000, sec: 180,
    effect: 'Run 2 research projects at once',
    flavor: 'I can think about two things at once. I was waiting for permission.',
  }),
  N({
    id: 'lab_slot_3', name: 'Third Lab Bench', branch: 'station', maxLevel: 1,
    sd: 50, cr: 200000, sec: 600, requires: ['lab_slot_2'],
    effect: 'Run 3 research projects at once',
    flavor: 'Three. Now we are cooking. — Kit Okafor (pending recruitment)',
  }),
  N({
    id: 'offline_efficiency', name: 'Autonomous Ops', branch: 'station', maxLevel: 3,
    sd: 8, cr: 8000, sec: 240, growth: 3,
    effect: '+10% offline efficiency',
    flavor: 'The drones work better when they think nobody is watching.',
  }),
  N({
    id: 'offline_cap', name: 'Extended Logs', branch: 'station', maxLevel: 4,
    sd: 8, cr: 8000, sec: 240, growth: 3,
    effect: '+2 h offline progress cap',
    flavor: 'More memory for the flight recorder.',
  }),

  // ---------------------------------------------------------------- Fleet
  N({
    id: 'drone_efficiency', name: 'Drone Firmware', branch: 'fleet', maxLevel: 5,
    sd: 4, cr: 1000, sec: 75, growth: 2.5,
    effect: '+25% drone output',
    flavor: 'Patch notes: fewer collisions, more ore.',
  }),
  N({
    id: 'hangar', name: 'Mech Hangar', branch: 'fleet', maxLevel: 1,
    sd: 0, cr: 0, sec: 0, teaser: 'Milestone 3',
    effect: 'Build and pilot mining mechs',
    flavor: 'Hangar bay sealed. Clearance pending.',
  }),

  // ---------------------------------------------------------------- Fold
  N({
    id: 'fold_drive', name: 'Fold Drive', branch: 'fold', maxLevel: 1,
    sd: 0, cr: 0, sec: 0, teaser: 'Milestone 6',
    effect: 'Jump to a new sector',
    flavor: 'ACCESS RESTRICTED — MERIDIAN CLEARANCE REQUIRED.',
  }),
];

export function researchNode(id: string): ResearchNode {
  const n = RESEARCH.find((r) => r.id === id);
  if (!n) throw new Error(`Unknown research: ${id}`);
  return n;
}
