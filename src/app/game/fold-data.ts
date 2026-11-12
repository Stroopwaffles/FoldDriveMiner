/**
 * Milestone 6 tuning: the Fold Drive, Fold Resonance and the Jump Core.
 */

export const FOLD = {
  /** Helium-3 units for a full charge in the home sector; ×growth per depth. */
  baseCharge: 3000,
  chargeGrowth: 1.6,
  /** Fuel values in Helium-3 units. Ingots count as the ore that made them. */
  voidglassUnits: 8,
  /** A merchant's fold charge cell adds this share of a full charge. */
  cellCharge: 0.05,
  /** Charge Efficiency research and Fold Harmonics: +% per level. */
  efficiencyPerLevel: 0.2,
  harmonicsPerLevel: 0.15,
  /** Over-charge cap: 100% plus this per Over-charge research level. */
  overchargePerLevel: 0.25,
  /**
   * Resonance = floor((run credits / unit) ^ exponent × mult × (1 + overchargeBonus × extra charge)).
   * M8 balance: 0.35 instead of a square root, so a ~100M-credit first run still pays ~40
   * but very long runs don't snowball (a day-long run pays ~800, not ~2,900).
   */
  resonanceUnit: 1e6,
  resonanceExponent: 0.35,
  resonanceMult: 8,
  overchargeBonus: 0.5,
  /** Passive production per lifetime Resonance point. */
  productionPerResonance: 0.02,
  /** Deeper sectors: production, clicks and raids all grow per depth. */
  depthProduction: 0.25,
  depthRaids: 0.3,
  /**
   * Deep Fold (Master the Cycle only): fold back to depth 1, trading the
   * Resonance layer (Resonance, lifetime Resonance, Jump Core) for Echoes.
   * Echoes = floor(sqrt(lifetime Resonance / echoUnit)).
   */
  deepMinDepth: 6,
  echoUnit: 50,
  /** Each Echo: more Resonance from every jump, and more production. */
  echoResonance: 0.1,
  echoProduction: 0.05,
  /** Mech frames you've built before cost this share of the price. */
  blueprintCost: 0.25,
  /** QoL and infrastructure research becomes permanent after this many runs. */
  permanentAfter: 2,
  destinations: 3,
};

/** Research that becomes permanent once you've had it in enough runs. */
export const PERMANENT_NODES = [
  'refinery',
  'auto_sell',
  'auto_refine',
  'market_analysis',
  'fleet_dispatch',
  'hangar',
  'repair_bay',
  'auto_repair',
  'lab_assistant',
];

export interface CoreUpgrade {
  id: string;
  name: string;
  desc: string;
  maxLevel: number;
  /** Resonance cost for level 1; ×growth per level after. */
  cost: number;
  growth: number;
}

export const CORE_UPGRADES: readonly CoreUpgrade[] = [
  { id: 'core_drones', name: 'Seed Fleet', desc: 'Start each sector with 10 more Prospector drones per level', maxLevel: 5, cost: 2, growth: 1.6 },
  { id: 'core_credits', name: 'Emergency Fund', desc: 'Start each sector with credits (5K, 20K, 80K, 320K)', maxLevel: 4, cost: 3, growth: 2 },
  { id: 'core_archive', name: 'Research Archive', desc: '+1 research node carried through each jump', maxLevel: 4, cost: 4, growth: 1.8 },
  { id: 'core_drill', name: 'Drill Memory', desc: 'Start with Drill Mk.II (level 1) or Mk.III (level 2)', maxLevel: 2, cost: 5, growth: 3 },
  { id: 'core_offline', name: 'Patient Core', desc: '+10% offline efficiency and +2 h offline cap per level', maxLevel: 3, cost: 3, growth: 2 },
  { id: 'core_sensors', name: 'Long-Range Sensors', desc: 'Reveal one more trait per destination; level 1 adds a 4th destination', maxLevel: 2, cost: 4, growth: 2 },
  { id: 'core_overdrive', name: 'Resonant Drill', desc: '+0.5× Overdrive multiplier per level', maxLevel: 2, cost: 3, growth: 2 },
  { id: 'core_bays', name: 'Spare Gantries', desc: '+1 mech hangar bay per level', maxLevel: 2, cost: 6, growth: 2.5 },
  { id: 'core_quarters', name: 'Extra Bunks', desc: '+1 pilot roster slot per level', maxLevel: 3, cost: 3, growth: 1.8 },
  { id: 'core_harmonics', name: 'Fold Harmonics', desc: '+15% Fold Drive charge efficiency per level', maxLevel: 3, cost: 3, growth: 1.8 },
];

export function coreDef(id: string): CoreUpgrade {
  return CORE_UPGRADES.find((c) => c.id === id)!;
}

/** Arrival lines after a jump (first jump gets the strange one). */
export const ARRIVAL = {
  first: [
    'Fold complete. All hands accounted for. …Commander, my chronometer logged the jump as taking minus four seconds. That is not possible.',
    "My bunk's exactly how I left it. Even the coffee stain. Wait — I haven't been in my bunk since before the jump.",
  ],
  later: [
    'Fold complete. New sector, same ship, same crew. Same feeling that we have done this before.',
    'Fold complete. The Fold Drive core temperature is lower than when we started. Thermodynamics disagrees.',
    'Fold complete. Beacon chatter on arrival… already addressed to us.',
  ],
};
