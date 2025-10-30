// Upgrade system for Rummy prototype
// Each upgrade has: id, displayName, description, tooltip, and either apply/remove functions or data properties

export const UPGRADES = [
  {
    id: 'wildfire',
    displayName: 'Wildfire',
    icon: '🔥',
    description: 'First meld each round scores x5',
    tooltip: 'One-time boost per round. Greys out after use, resets next round.',
    apply: (player) => {
      player.wildfireAvailable = true;
    },
    remove: (player) => {
      player.wildfireAvailable = false;
    }
  },

  {
    id: 'face_cards',
    displayName: 'Face Cards',
    icon: '👑',
    description: 'J/Q/K worth 20 instead of 10',
    tooltip: 'Increases base score for face cards in melds and layoffs. Permanent.',
    apply: (player) => {
      player.cardValueOverrides.J = 20;
      player.cardValueOverrides.Q = 20;
      player.cardValueOverrides.K = 20;
    },
    remove: (player) => {
      delete player.cardValueOverrides.J;
      delete player.cardValueOverrides.Q;
      delete player.cardValueOverrides.K;
    }
  },

  {
    id: 'combo_master',
    displayName: 'Combo Master',
    icon: '⚡',
    description: 'Every 3rd meld/layoff gives +50 bonus',
    tooltip: '+50 flat bonus added to base score, then multiplied. Counter shows X/3.',
    // Logic handled in scoring calculation
  },

  {
    id: 'recycling_plant',
    displayName: 'Recycling Plant',
    icon: '♻️',
    description: '+X to all actions, X increases by 1 when you discard',
    tooltip: 'X starts at 0 each round. +1 per discard. Added to base before multipliers.',
    apply: (player) => {
      player.recyclingPlantBonus = 0;
    },
    remove: (player) => {
      player.recyclingPlantBonus = 0;
    }
  },

  {
    id: 'gemini',
    displayName: 'Gemini',
    icon: '♊',
    description: 'You can meld Pairs, they score x2',
    tooltip: 'Pairs = 2 matching cards. Anyone can layoff. Meld 3+ pairs → Hexagram (x1.6).',
    apply: (player) => {
      player.canMeldPairs = true;
    },
    remove: (player) => {
      player.canMeldPairs = false;
    }
  },

  {
    id: 'evo_scale',
    displayName: 'Evo Scale',
    icon: '✖️',
    description: 'x1.5 to all actions, +x0.5 after each win/loss',
    tooltip: 'Starts at x1.5. Grows by x0.5 every round. Applied after action multipliers.',
    apply: (player) => {
      player.upgradeMultipliers.all *= 1.5;
      player.evoScaleWins = 0;
      player.evoScaleLosses = 0;
    },
    remove: (player) => {
      player.upgradeMultipliers.all /= 1.5;
      player.evoScaleWins = 0;
      player.evoScaleLosses = 0;
    }
  },

  {
    id: 'evo_base',
    displayName: 'Evo Base',
    icon: '➕',
    description: '+10 to all actions, +5 after each win/loss',
    tooltip: 'Starts at +10. Grows by +5 every round. Added to base before multipliers.',
    apply: (player) => {
      player.baseMod += 10;
      player.evoBaseWins = 0;
      player.evoBaseLosses = 0;
    },
    remove: (player) => {
      player.baseMod -= 10;
      player.evoBaseWins = 0;
      player.evoBaseLosses = 0;
    }
  }
];

// Helper to get upgrade by ID
export function getUpgrade(id) {
  return UPGRADES.find(u => u.id === id);
}

// Helper to get 3 random upgrades (no duplicates)
export function getRandomUpgrades(count = 3, excludeIds = []) {
  const available = UPGRADES.filter(u => !excludeIds.includes(u.id));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, available.length));
}
