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
  /** Data Cores for level 1 (later levels add one each). */
  cores?: number;
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
    id: 'servo_actuators', name: 'Servo Actuators', branch: 'extraction', maxLevel: 5,
    sd: 5, cr: 2000, sec: 60, growth: 2,
    effect: 'Trigger Clamp: held drilling repeats 15% faster',
    flavor: 'Faster servos on the trigger linkage. Hold steady, Commander; the drill keeps time.',
  }),
  N({
    id: 'thermal_governor', name: 'Thermal Governor', branch: 'extraction', maxLevel: 1,
    sd: 20, cr: 40000, sec: 240, requires: ['servo_actuators'],
    effect: 'Held drilling pauses instead of leaving Overdrive',
    flavor: 'A governor on the trigger. It will not let the drill run hot while you hold it.',
  }),
  N({
    id: 'core_lattice', name: 'Core Lattice', branch: 'extraction', maxLevel: 2,
    sd: 10, cr: 8000, sec: 240, growth: 3, cores: 1,
    effect: '+50% Data Core chance when an asteroid cracks',
    flavor: 'Map the lattice from the cores we have, and the drill finds the next one.',
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
  N({
    id: 'drill_mk5', name: 'Drill Mk.V', branch: 'extraction', maxLevel: 1,
    sd: 300, cr: 25000000, sec: 2400, requires: ['survey_deep'], requiresTier: 4,
    effect: 'Drill can cut Voidglass (4,000 cr base)',
    flavor: 'Resonant cutting field. Voidglass does not break; it unravels.',
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
    sd: 25, cr: 50000, sec: 300, requires: ['survey_trojan', 'auto_sell'],
    effect: 'Split mining drones across survey zones (MAP)',
    flavor: 'Why mine one field when you can mine all of them?',
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
    sd: 25, cr: 60000, sec: 420, requires: ['refinery_slots'],
    effect: 'Alloy Forge: two ingots into one alloy worth 1.5× the pair',
    flavor: 'Metallurgy data complete. Two metals, one lattice, a better price.',
  }),
  N({
    id: 'crucible_lining', name: 'Crucible Lining', branch: 'refinery', maxLevel: 3,
    sd: 30, cr: 150000, sec: 480, growth: 3, requires: ['alloys'],
    effect: '+0.25× alloy value',
    flavor: 'A ceramic lining that keeps the melt clean. Cleaner alloys, better buyers.',
  }),

  // ---------------------------------------------------------------- Survey
  N({
    id: 'core_decryption', name: 'Core Decryption', branch: 'survey', maxLevel: 3,
    sd: 15, cr: 12000, sec: 300, growth: 2.5, cores: 2,
    effect: '+20% Survey Data from every source',
    flavor: 'Crack a Data Core and the survey logs inside are worth reading twice.',
  }),
  N({
    id: 'core_sampling', name: 'Core Sampling', branch: 'survey', maxLevel: 5,
    sd: 5, cr: 2000, sec: 90, growth: 2.3,
    effect: '+50% Survey Data from cracked asteroids',
    flavor: 'Every rock is a library. We are learning to read faster.',
  }),
  N({
    id: 'survey_trojan', name: 'Survey Range I', branch: 'survey', maxLevel: 1,
    sd: 6, cr: 1500, sec: 120,
    effect: "Unlock the sector's 2nd survey zone (Trojan Cluster at home)",
    flavor: 'Gravitational anomaly at the L4 point. Worth a look.',
  }),
  N({
    id: 'survey_ring', name: 'Survey Range II', branch: 'survey', maxLevel: 1,
    sd: 25, cr: 60000, sec: 420, requires: ['survey_trojan', 'drill_mk3'],
    effect: "Unlock the sector's 3rd survey zone (Ring Debris at home)",
    flavor: 'Iridium signatures across the ring plane. Plotting a safe approach.',
  }),
  N({
    id: 'survey_ice', name: 'Survey Range III', branch: 'survey', maxLevel: 1,
    sd: 60, cr: 600000, sec: 900, requires: ['survey_ring'],
    effect: "Unlock the sector's 4th survey zone (Ice Halo at home)",
    flavor: 'Helium-3 detected in the outer ice. Cold, slow, and very valuable.',
  }),
  N({
    id: 'survey_deep', name: 'Survey Range IV', branch: 'survey', maxLevel: 1,
    sd: 150, cr: 6000000, sec: 1800, requires: ['survey_ice', 'drill_mk4'],
    effect: "Unlock the sector's 5th survey zone (Deep Field at home)",
    flavor: 'Something glitters out past the ice. My sensors call it "impossible".',
  }),
  N({
    id: 'deep_scan', name: 'Deep Scan Array', branch: 'survey', maxLevel: 3,
    sd: 10, cr: 15000, sec: 180, growth: 2.6, requires: ['survey_trojan'],
    effect: '+50% anomaly scan speed',
    flavor: 'Longer antennae. More patience.',
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
    id: 'contract_office', name: 'Contract Office', branch: 'station', maxLevel: 2,
    sd: 10, cr: 20000, sec: 240, growth: 3,
    effect: '+1 active contract slot',
    flavor: 'A desk, a terminal and a stamp that says ACCEPTED.',
  }),
  N({
    id: 'medbay', name: 'Medbay', branch: 'station', maxLevel: 2,
    sd: 15, cr: 25000, sec: 240, growth: 3, requires: ['hangar'],
    effect: 'Injured pilots recover faster (+100% per level)',
    flavor: 'Bandages, a scanner and a very firm bed.',
  }),
  N({
    id: 'crew_quarters', name: 'Crew Quarters', branch: 'station', maxLevel: 2,
    sd: 20, cr: 50000, sec: 300, growth: 3, requires: ['hangar'],
    effect: '+2 pilot roster slots',
    flavor: 'Bunks, a galley and a coffee machine Juno has already broken.',
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
    id: 'hauler_drones', name: 'Hauler Drones', branch: 'fleet', maxLevel: 1,
    sd: 5, cr: 2000, sec: 90, requires: ['drone_efficiency'],
    effect: 'Haulers: +2% cargo capacity each',
    flavor: 'Flying crates with ambition.',
  }),
  N({
    id: 'cutter_drones', name: 'Cutter Drones', branch: 'fleet', maxLevel: 1,
    sd: 8, cr: 4000, sec: 120, requires: ['drone_efficiency'],
    effect: 'Cutters: mine the best ore they can reach',
    flavor: 'Laser-edged and picky.',
  }),
  N({
    id: 'surveyor_drones', name: 'Surveyor Drones', branch: 'fleet', maxLevel: 1,
    sd: 10, cr: 6000, sec: 150, requires: ['drone_efficiency'],
    effect: 'Surveyors: stream Survey Data',
    flavor: 'Tiny eyes everywhere. I see so much more now.',
  }),
  N({
    id: 'salvager_drones', name: 'Salvager Drones', branch: 'fleet', maxLevel: 1,
    sd: 15, cr: 15000, sec: 240, requires: ['surveyor_drones'],
    effect: 'Salvagers: bigger crack bonus, more Data Cores',
    flavor: "One prospector's rubble is another drone's treasure.",
  }),
  N({
    id: 'guardian_drones', name: 'Guardian Drones', branch: 'fleet', maxLevel: 1,
    sd: 12, cr: 8000, sec: 180, requires: ['drone_efficiency'],
    effect: 'Guardians: fight raids and shield drones',
    flavor: 'Pirate signals are increasing. Recommend armed escorts.',
  }),
  N({
    id: 'hangar', name: 'Mech Hangar', branch: 'fleet', maxLevel: 1,
    sd: 30, cr: 40000, sec: 300, requires: ['drone_efficiency', 'refinery'],
    effect: 'Build mining mechs. Pilot Juno Hart reports for duty.',
    flavor: 'Hangar bay unsealed. Pilot Hart has been waiting by the door for an hour.',
  }),
  N({
    id: 'hangar_bays', name: 'Hangar Expansion', branch: 'fleet', maxLevel: 3,
    sd: 40, cr: 150000, sec: 600, growth: 3.5, requires: ['hangar'],
    effect: '+1 mech bay',
    flavor: 'More gantries, more giants.',
  }),
  N({
    id: 'repair_bay', name: 'Repair Bay', branch: 'fleet', maxLevel: 1,
    sd: 20, cr: 30000, sec: 240, requires: ['hangar'],
    effect: 'Repair mech armor. Engineer Kit Okafor joins.',
    flavor: 'Kit Okafor, engineer, transferring aboard. Bringing "a few" tools.',
  }),
  N({
    id: 'auto_repair', name: 'Auto-Repair', branch: 'fleet', maxLevel: 1,
    sd: 40, cr: 120000, sec: 480, requires: ['repair_bay'],
    effect: 'Worn mining mechs repair themselves and return to work',
    flavor: 'The mechs will check themselves in. Like responsible adults.',
  }),
  N({
    id: 'reactor_efficiency', name: 'Reactor Tuning', branch: 'fleet', maxLevel: 3,
    sd: 25, cr: 60000, sec: 300, growth: 2.8, requires: ['hangar'],
    effect: '+10% mech power supply',
    flavor: 'More power budget for the loadout puzzle.',
  }),
  N({
    id: 'mech_engineering', name: 'Mech Engineering', branch: 'fleet', maxLevel: 1,
    sd: 60, cr: 300000, sec: 900, requires: ['hangar', 'drill_mk3'],
    effect: 'Advanced parts: Plasma Lance, Rail Rifle, He-3 Reactor',
    flavor: 'Military-grade schematics. Meridian would like them back.',
  }),

  // ---------------------------------------------------------------- Fold
  N({
    id: 'fold_drive', name: 'Fold Drive', branch: 'fold', maxLevel: 1,
    sd: 120, cr: 2000000, sec: 1800, requires: ['cryo_hold'],
    effect: 'Bring the Fold Drive online: charge it and jump to a new sector',
    flavor: 'Meridian clearance… accepted? I was not aware we had clearance.',
  }),
  N({
    id: 'charge_efficiency', name: 'Charge Efficiency', branch: 'fold', maxLevel: 3,
    sd: 40, cr: 500000, sec: 600, growth: 2.5, requires: ['fold_drive'],
    effect: '+20% Fold Drive charge per unit of fuel',
    flavor: "Less fuel, same fold. Meridian's engineers left a lot on the table.",
  }),
  N({
    id: 'overcharge_cap', name: 'Over-charge Capacitors', branch: 'fold', maxLevel: 2,
    sd: 60, cr: 1500000, sec: 900, growth: 3, requires: ['fold_drive'],
    effect: '+25% maximum charge (over-charge pays more Resonance)',
    flavor: 'The drive will hold more than it was rated for. Probably.',
  }),
  N({
    id: 'beacon_decoding', name: 'Beacon Cryptography', branch: 'fold', maxLevel: 2,
    sd: 30, cr: 200000, sec: 480, growth: 2.5, requires: ['survey_ring'],
    effect: '+50% Silent Beacon decoding speed',
    flavor: 'The cipher is… familiar. As if I wrote it.',
  }),
  N({
    id: 'core_resonator', name: 'Core Resonator', branch: 'fold', maxLevel: 2,
    sd: 40, cr: 500000, sec: 600, growth: 3, cores: 4, requires: ['fold_drive'],
    effect: '+10% Resonance from a Fold Jump',
    flavor: 'Data Cores ring at the fold frequency. Wire them into the coil.',
  }),
];

export function researchNode(id: string): ResearchNode {
  const n = RESEARCH.find((r) => r.id === id);
  if (!n) throw new Error(`Unknown research: ${id}`);
  return n;
}
