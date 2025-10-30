import config from './config.json' with { type: 'json' };
import { Deck, sortHand } from './deck.js';
import { Meld } from './meld.js';
import { getUpgrade } from './upgrades.js';

export class Player {
  constructor(name) {
    this.name = name;
    this.hand = [];
    this.melds = [];
    this.points = 0; // Points accumulated during current round (formerly runningScore)
    this.layoffCount = 0; // Tracks layoffs this round for layoff bonus
    this.carryoverMultiplier = 1.0; // Catchup bonus from previous round

    // Upgrade system
    this.upgrades = []; // Array of upgrade IDs
    this.upgradeMultipliers = {
      meld: 1.0,   // Applied to all melds (WILDFIRE uses this)
      layoff: 1.0, // Applied to all layoffs
      all: 1.0     // Applied to everything (GENERIC MULTI)
    };
    this.baseMod = 0;    // Added to base points before mults (GENERIC BASE)
    this.cardValueOverrides = {}; // { J: 20, Q: 20, K: 20 } for FACE CARDS
    this.comboCount = 0; // For COMBO MASTER tracking
    this.pairsMelded = 0; // For GEMINI + HEXAGRAM
    this.canMeldPairs = false; // GEMINI upgrade flag

    // New upgrade tracking fields
    this.wildfireAvailable = false; // WILDFIRE - resets each round
    this.recyclingPlantBonus = 0; // RECYCLING PLANT - increments on discard
    this.evoScaleWins = 0; // EVO SCALE - persists across rounds
    this.evoScaleLosses = 0;
    this.evoBaseWins = 0; // EVO BASE - persists across rounds
    this.evoBaseLosses = 0;
    this.meldCount = 0; // Track melds this round for Alchemist
    this.setCount = 0; // Track sets for Slot Machine
    this.runCount = 0; // Track runs for Marathon
  }

  addCard(card) {
    this.hand.push(card);
  }

  removeCard(card) {
    const index = this.hand.findIndex(c =>
      c.rank === card.rank && c.suit === card.suit
    );
    if (index !== -1) {
      this.hand.splice(index, 1);
    }
  }

  removeCards(cards) {
    cards.forEach(card => this.removeCard(card));
  }

  addMeld(meld) {
    this.melds.push(meld);
  }

  getDeadwoodValue() {
    return this.hand.reduce((sum, card) => sum + card.getValue(), 0);
  }

  getMeldsValue() {
    return this.melds.reduce((sum, meld) => sum + meld.getValue(), 0);
  }

  hasWon() {
    return this.hand.length === 0;
  }

  addScore(pointsToAdd) {
    this.points += pointsToAdd;
  }

  incrementLayoffCount() {
    this.layoffCount++;
  }

  resetRoundState() {
    this.hand = [];
    this.melds = [];
    this.points = 0;
    this.layoffCount = 0;
    this.comboCount = 0;
    this.pairsMelded = 0;
    this.emptiedHandEarly = false; // Track if player emptied hand before discard
    this.meldCount = 0; // Track melds for Alchemist
    this.setCount = 0; // Track sets for Slot Machine
    this.runCount = 0; // Track runs for Marathon

    // Reset Wildfire availability if player has it
    if (this.hasUpgrade('wildfire')) {
      this.wildfireAvailable = true;
    }

    // Reset Recycling Plant bonus
    if (this.hasUpgrade('recycling_plant')) {
      this.recyclingPlantBonus = 0;
    }

    // carryoverMultiplier is NOT reset here - it persists to next round
    // evoScale/evoBase wins/losses persist across rounds
    // upgrades and their effects persist across rounds
  }

  getCardValue(card) {
    // Check for upgrade overrides first
    if (this.cardValueOverrides[card.rank] !== undefined) {
      return this.cardValueOverrides[card.rank];
    }
    return card.getValue();
  }

  addUpgrade(upgradeId) {
    if (this.upgrades.includes(upgradeId)) return;
    this.upgrades.push(upgradeId);
  }

  hasUpgrade(upgradeId) {
    return this.upgrades.includes(upgradeId);
  }

  applyCarryoverAndReset() {
    // After carryover is used in round-end calculation, reset it
    this.carryoverMultiplier = 1.0;
  }
}

export class GameState {
  constructor() {
    this.players = config.players.map(name => new Player(name));
    this.currentPlayerIndex = 0;
    this.stock = new Deck();
    this.discardPile = [];
    this.roundNumber = 1;
    this.scoreHistory = [];
    this.reshuffleCount = 0;
    this.phase = 'draw'; // 'draw', 'meld', 'discard'
    this.roundActive = false;
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  getAllMelds() {
    return this.players.flatMap(player => player.melds);
  }

  // Calculate meld points with upgrade multipliers
  // Formula: (basePoints + baseMod) * actionMult * upgradeMultipliers
  calculateMeldScore(meld, player) {
    let basePoints = 0;
    meld.cards.forEach(card => {
      basePoints += player.getCardValue(card);
    });

    // Add baseMod once per action
    let totalBaseMod = player.baseMod;

    // Add Recycling Plant bonus
    if (player.hasUpgrade('recycling_plant')) {
      totalBaseMod += player.recyclingPlantBonus;
    }

    // Add Evo Base bonus
    if (player.hasUpgrade('evo_base')) {
      const evoBonus = (player.evoBaseWins + player.evoBaseLosses) * 5;
      totalBaseMod += evoBonus;
    }

    basePoints += totalBaseMod;

    // Apply action multiplier (setMod, runMod, or pairMod)
    let actionMult;
    if (meld.isPair()) {
      actionMult = config.pairMod; // Pairs score x2 with Gemini
    } else if (meld.type === 'set') {
      actionMult = config.setMod;
    } else {
      actionMult = config.runMod;
    }

    // Apply upgrade multipliers
    let upgradeMult = player.upgradeMultipliers.meld * player.upgradeMultipliers.all;

    // Wildfire: x5 multiplier on first meld
    if (player.hasUpgrade('wildfire') && player.wildfireAvailable) {
      upgradeMult *= 5;
      player.wildfireAvailable = false; // Used up for this round
    }

    // Evo Scale: Add extra multiplier based on wins/losses
    if (player.hasUpgrade('evo_scale')) {
      const evoBonus = (player.evoScaleWins + player.evoScaleLosses) * 0.5;
      upgradeMult *= (1 + evoBonus);
    }

    const finalScore = Math.round(basePoints * actionMult * upgradeMult);

    return {
      baseScore: basePoints - totalBaseMod, // Show original base without baseMod
      baseMod: totalBaseMod,
      modifier: actionMult,
      upgradeMult: upgradeMult,
      finalScore,
      type: meld.type
    };
  }

  // Calculate layoff points with upgrade multipliers
  calculateLayoffScore(card, player) {
    let totalBaseMod = player.baseMod;

    // Add Recycling Plant bonus
    if (player.hasUpgrade('recycling_plant')) {
      totalBaseMod += player.recyclingPlantBonus;
    }

    // Add Evo Base bonus
    if (player.hasUpgrade('evo_base')) {
      const evoBonus = (player.evoBaseWins + player.evoBaseLosses) * 5;
      totalBaseMod += evoBonus;
    }

    const basePoints = player.getCardValue(card) + totalBaseMod;

    // Apply upgrade multipliers
    let upgradeMult = player.upgradeMultipliers.layoff * player.upgradeMultipliers.all;

    // Evo Scale: Add extra multiplier based on wins/losses
    if (player.hasUpgrade('evo_scale')) {
      const evoBonus = (player.evoScaleWins + player.evoScaleLosses) * 0.5;
      upgradeMult *= (1 + evoBonus);
    }

    const finalScore = Math.round(basePoints * config.layMod * upgradeMult);

    return {
      baseScore: player.getCardValue(card),
      baseMod: totalBaseMod,
      modifier: config.layMod,
      upgradeMult: upgradeMult,
      finalScore
    };
  }

  startNewRound() {
    // Reset players (keeps carryoverMultiplier intact)
    this.players.forEach(player => {
      player.resetRoundState();
    });

    // Reset deck and deal
    this.stock = new Deck();
    this.stock.shuffle();
    this.discardPile = [];
    this.reshuffleCount = 0;
    this.currentPlayerIndex = 0;
    this.phase = 'draw';

    // Deal cards
    for (let i = 0; i < config.cardsPerPlayer; i++) {
      this.players.forEach(player => {
        player.addCard(this.stock.draw());
      });
    }

    // Start discard pile
    this.discardPile.push(this.stock.draw());
    this.roundActive = true;
  }

  drawFromStock() {
    if (this.stock.isEmpty()) {
      const reshuffleResult = this.reshuffle();
      if (reshuffleResult.stalemate) {
        // Can't reshuffle, stalemate condition
        return { card: null, stalemate: true };
      }
    }

    if (this.stock.isEmpty()) {
      // Should not happen, but safety check
      return { card: null, stalemate: true };
    }

    const card = this.stock.draw();
    this.getCurrentPlayer().addCard(card);
    return { card, stalemate: false };
  }

  drawFromDiscard() {
    if (this.discardPile.length === 0) return null;

    const card = this.discardPile.pop();
    this.getCurrentPlayer().addCard(card);
    return card;
  }

  discard(card) {
    const player = this.getCurrentPlayer();
    player.removeCard(card);
    this.discardPile.push(card);

    // Recycling Plant: Increment bonus counter on discard
    if (player.hasUpgrade('recycling_plant')) {
      player.recyclingPlantBonus++;
    }

    // Return what happened - client decides what to do next
    return {
      playerWon: player.hasWon()
    };
  }

  createMeld(cards) {
    const player = this.getCurrentPlayer();
    const meld = new Meld(cards, player.name);

    // Check if it's a valid meld
    if (!meld.isValid()) {
      // Special case: check if it's a pair and player has GEMINI
      if (meld.isPair() && player.canMeldPairs) {
        // Pair is valid with GEMINI - continue
      } else {
        return { success: false, reason: 'Invalid meld' };
      }
    }

    player.removeCards(cards);
    player.addMeld(meld);

    // Track meld counts for bonuses
    player.meldCount++;
    if (meld.isPair()) {
      player.pairsMelded++;
    } else if (meld.type === 'set') {
      player.setCount++;
    } else if (meld.type === 'run') {
      player.runCount++;
    }

    // Calculate and apply score immediately with upgrade multipliers
    const scoreBreakdown = this.calculateMeldScore(meld, player);
    player.addScore(scoreBreakdown.finalScore);

    // Increment combo counter
    player.comboCount++;

    // Check for COMBO MASTER bonus (every 3rd action)
    if (player.hasUpgrade('combo_master') && player.comboCount % 3 === 0) {
      const comboBonus = Math.round(50 * player.upgradeMultipliers.all);
      player.addScore(comboBonus);
      scoreBreakdown.comboBonus = comboBonus;
    }

    // Check if player emptied their hand (win without discard)
    if (player.hasWon()) {
      player.emptiedHandEarly = true;
    }

    return {
      success: true,
      meld,
      scoreBreakdown,
      playerWon: player.hasWon()
    };
  }

  layoff(card, meldIndex) {
    const allMelds = this.getAllMelds();

    if (meldIndex < 0 || meldIndex >= allMelds.length) {
      return { success: false, reason: 'Invalid meld index' };
    }

    const meld = allMelds[meldIndex];

    if (!meld.canLayoff(card)) {
      return { success: false, reason: 'Card cannot be laid off on this meld' };
    }

    const player = this.getCurrentPlayer();
    player.removeCard(card);
    meld.addCard(card);

    // Calculate and apply score immediately with upgrade multipliers
    const scoreBreakdown = this.calculateLayoffScore(card, player);
    player.addScore(scoreBreakdown.finalScore);
    player.incrementLayoffCount();

    // Increment combo counter
    player.comboCount++;

    // Check for COMBO MASTER bonus (every 3rd action)
    if (player.hasUpgrade('combo_master') && player.comboCount % 3 === 0) {
      const comboBonus = Math.round(50 * player.upgradeMultipliers.all);
      player.addScore(comboBonus);
      scoreBreakdown.comboBonus = comboBonus;
    }

    // Check if player emptied their hand (win without discard)
    if (player.hasWon()) {
      player.emptiedHandEarly = true;
    }

    return {
      success: true,
      meld,
      scoreBreakdown,
      playerWon: player.hasWon()
    };
  }

  reshuffle() {
    if (this.reshuffleCount >= config.maxReshuffles) {
      // Stalemate - can't reshuffle anymore
      return { success: false, stalemate: true };
    }

    this.reshuffleCount++;

    // Keep top card of discard pile, shuffle rest into stock
    const topCard = this.discardPile.pop();

    this.stock.cards = this.discardPile;
    this.stock.shuffle();

    this.discardPile = [this.stock.draw()]; // Start new discard pile

    return { success: true, stalemate: false };
  }

  // Calculate round-end bonuses for a player
  calculateRoundEndBonuses(player, winner, totalDeadwood) {
    const bonuses = {
      flatBonuses: [],
      multipliers: []
    };

    // Win bonus (flat)
    if (player === winner) {
      bonuses.flatBonuses.push({
        name: 'Win Bonus',
        value: config.winBonus
      });

      // Deadwood bonus (flat, winner only)
      const deadwoodBonus = Math.min(
        Math.round(totalDeadwood / config.deadwoodBonusDivisor),
        config.deadwoodBonusCap
      );
      bonuses.flatBonuses.push({
        name: 'Deadwood Bonus',
        value: deadwoodBonus
      });
    }

    // Overflow bonus (flat) - emptied hand before discard
    if (player.emptiedHandEarly) {
      bonuses.flatBonuses.push({
        name: 'Overflow Bonus',
        value: config.overflowBonus
      });
    }

    // Layoff bonus (multiplier) - capped at 3 layoffs
    if (player.layoffCount > 0) {
      const cappedLayoffCount = Math.min(player.layoffCount, config.layoffBonusCap);
      const layoffMult = 1 + (cappedLayoffCount * config.layoffBonusPerLevel);
      bonuses.multipliers.push({
        name: 'Layoff Bonus',
        value: layoffMult,
        detail: `${player.layoffCount} layoffs${player.layoffCount > config.layoffBonusCap ? ' (capped at 3)' : ''}`
      });
    }

    // Alchemist bonus (multiplier) - x(1 + 0.5 per meld + 0.1 per layoff)
    if (player.meldCount > 0 || player.layoffCount > 0) {
      const alchemistMult = 1 + (player.meldCount * 0.5) + (player.layoffCount * 0.1);
      bonuses.multipliers.push({
        name: config.oneMeldBonus[0],
        value: alchemistMult,
        detail: `${player.meldCount} melds, ${player.layoffCount} layoffs`
      });
    }

    // Hut Hike bonus (multiplier) - set + run (no layoff requirement)
    const hasSet = player.setCount > 0;
    const hasRun = player.runCount > 0;
    if (hasSet && hasRun) {
      bonuses.multipliers.push({
        name: config.setRunLayBonus[0],
        value: config.setRunLayBonus[1],
        detail: 'set + run'
      });
    }

    // Marathon bonus (multiplier) - 2+ runs
    if (player.runCount >= 2) {
      bonuses.multipliers.push({
        name: config.doubleRunBonus[0],
        value: config.doubleRunBonus[1],
        detail: `${player.runCount} runs`
      });
    }

    // Slot Machine bonus (multiplier) - 2+ sets
    if (player.setCount >= 2) {
      bonuses.multipliers.push({
        name: config.doubleSetBonus[0],
        value: config.doubleSetBonus[1],
        detail: `${player.setCount} sets`
      });
    }

    // Hexagram bonus (multiplier) - melded 3 pairs this round
    if (player.pairsMelded >= 3) {
      bonuses.multipliers.push({
        name: config.hexagramBonus[0],
        value: config.hexagramBonus[1],
        detail: `melded ${player.pairsMelded} pairs`
      });
    }

    // Carryover multiplier from previous round
    if (player.carryoverMultiplier > 1.0) {
      bonuses.multipliers.push({
        name: 'Catchup Bonus',
        value: player.carryoverMultiplier,
        detail: 'from previous round'
      });
    }

    return bonuses;
  }

  // Automatically layoff deadwood at round end (randomly)
  autoLayoffDeadwood() {
    const layoffLog = [];

    this.players.forEach(player => {
      if (player.hand.length === 0) return; // Skip if player has no deadwood

      const allMelds = this.getAllMelds();
      if (allMelds.length === 0) return; // No melds to layoff onto

      // Try to layoff each card in hand randomly
      const handCopy = [...player.hand];
      handCopy.forEach(card => {
        const validMelds = allMelds
          .map((meld, index) => ({ meld, index }))
          .filter(({ meld }) => meld.canLayoff(card));

        if (validMelds.length > 0) {
          // Pick a random valid meld
          const { meld, index } = validMelds[Math.floor(Math.random() * validMelds.length)];

          player.removeCard(card);
          meld.addCard(card);

          // Calculate and apply score with upgrade multipliers
          const scoreBreakdown = this.calculateLayoffScore(card, player);
          player.addScore(scoreBreakdown.finalScore);
          player.incrementLayoffCount();

          layoffLog.push({
            player: player.name,
            card: card.toString(),
            meldOwner: meld.owner,
            score: scoreBreakdown.finalScore
          });
        }
      });
    });

    return layoffLog;
  }

  endRound() {
    const winner = this.getCurrentPlayer();

    // Auto-layoff deadwood before calculating bonuses
    const autoLayoffLog = this.autoLayoffDeadwood();

    // RECYCLED WOOD: Score deadwood before bonuses, then remove it
    const recycledWoodLog = [];
    this.players.forEach(player => {
      if (player.hasUpgrade('recycled_wood') && player.hand.length > 0) {
        const deadwoodCount = player.hand.length;
        const recycledScore = deadwoodCount * 5;
        player.addScore(recycledScore);
        recycledWoodLog.push({
          player: player.name,
          deadwoodCount,
          score: recycledScore
        });
        // Remove all deadwood from hand
        player.hand = [];
      }
    });

    const scores = {};
    const bonusDetails = {};

    // Calculate total deadwood from non-winners for deadwood bonus
    const totalDeadwood = this.players
      .filter(p => p !== winner)
      .reduce((sum, p) => sum + p.getDeadwoodValue(), 0);

    this.players.forEach(player => {
      const bonuses = this.calculateRoundEndBonuses(player, winner, totalDeadwood);

      // Start with round points
      let finalScore = player.points;

      // Add flat bonuses
      bonuses.flatBonuses.forEach(bonus => {
        finalScore += bonus.value;
      });

      // Apply multipliers
      let totalMultiplier = 1.0;
      bonuses.multipliers.forEach(bonus => {
        totalMultiplier *= bonus.value;
      });
      finalScore = Math.round(finalScore * totalMultiplier);

      scores[player.name] = finalScore;
      bonusDetails[player.name] = {
        roundPoints: player.points,
        flatBonuses: bonuses.flatBonuses,
        multipliers: bonuses.multipliers,
        totalMultiplier,
        finalScore,
        deadwood: player.getDeadwoodValue()
      };

      // Set catchup bonus for next round based on total score deficit from leader
      const totalScores = this.getTotalScores();
      const playerTotal = totalScores[player.name] || 0;
      const leaderTotal = Math.max(...Object.values(totalScores));
      const totalDeficit = leaderTotal - playerTotal;

      if (totalDeficit > 0) {
        // Behind the leader - get catchup bonus for next round
        const catchupMult = 1 + (totalDeficit * config.catchupBonusPerDeficit);
        player.carryoverMultiplier = catchupMult;
      } else {
        // Leader or tied - no catchup bonus
        player.carryoverMultiplier = 1.0;
      }

      // Evo Scale/Base: Track wins and losses
      if (player === winner) {
        if (player.hasUpgrade('evo_scale')) {
          player.evoScaleWins++;
        }
        if (player.hasUpgrade('evo_base')) {
          player.evoBaseWins++;
        }
      } else {
        if (player.hasUpgrade('evo_scale')) {
          player.evoScaleLosses++;
        }
        if (player.hasUpgrade('evo_base')) {
          player.evoBaseLosses++;
        }
      }
    });

    this.scoreHistory.push({
      round: this.roundNumber,
      scores: scores,
      bonusDetails: bonusDetails,
      winner: winner.name,
      autoLayoffLog: autoLayoffLog,
      recycledWoodLog: recycledWoodLog
    });

    this.roundNumber++;
    this.roundActive = false;

    return { scores, bonusDetails, autoLayoffLog, recycledWoodLog };
  }

  endRoundStalemate() {
    const scores = {};
    const bonusDetails = {};

    // Apply round-end bonuses but skip win/deadwood bonuses (no winner)
    this.players.forEach(player => {
      const bonuses = this.calculateRoundEndBonuses(player, null, 0); // null winner, 0 deadwood

      // Calculate total multiplier from all bonuses
      let totalMultiplier = 1.0;
      bonuses.multipliers.forEach(bonus => {
        totalMultiplier *= bonus.value;
      });

      // Apply multipliers to running score (no flat bonuses for stalemate)
      const finalScore = Math.round(player.points * totalMultiplier);
      scores[player.name] = finalScore;

      bonusDetails[player.name] = {
        roundPoints: player.points,
        flatBonuses: [], // No win/deadwood bonuses
        multipliers: bonuses.multipliers,
        totalMultiplier,
        finalScore
      };
    });

    // Set catchup bonus for next round based on total score deficit from leader
    const totalScores = this.getTotalScores();
    this.players.forEach(player => {
      const playerTotal = totalScores[player.name] || 0;
      const leaderTotal = Math.max(...Object.values(totalScores));
      const totalDeficit = leaderTotal - playerTotal;

      if (totalDeficit > 0) {
        // Behind the leader - get catchup bonus for next round
        const catchupMult = 1 + (totalDeficit * config.catchupBonusPerDeficit);
        player.carryoverMultiplier = catchupMult;
      } else {
        // Leader or tied - no catchup bonus
        player.carryoverMultiplier = 1.0;
      }

      // Evo Scale/Base: In stalemate, everyone loses (no winner)
      if (player.hasUpgrade('evo_scale')) {
        player.evoScaleLosses++;
      }
      if (player.hasUpgrade('evo_base')) {
        player.evoBaseLosses++;
      }
    });

    this.scoreHistory.push({
      round: this.roundNumber,
      scores: scores,
      stalemate: true
    });

    this.roundNumber++;
    this.roundActive = false;

    return { scores, bonusDetails };
  }

  nextPlayer() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.phase = 'draw';
  }

  setPhase(phase) {
    this.phase = phase;
  }

  getTotalScores() {
    const totals = {};
    config.players.forEach(name => totals[name] = 0);

    this.scoreHistory.forEach(round => {
      Object.entries(round.scores).forEach(([name, score]) => {
        totals[name] += score;
      });
    });

    return totals;
  }

  // Apply an upgrade to a player
  applyUpgrade(player, upgradeId) {
    const upgrade = getUpgrade(upgradeId);
    if (!upgrade) return false;

    player.addUpgrade(upgradeId);

    // Apply the upgrade effect if it has an apply function
    if (upgrade.apply) {
      upgrade.apply(player);
    }

    return true;
  }
}
