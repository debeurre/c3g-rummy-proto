import config from './config.json' with { type: 'json' };

export class Meld {
  constructor(cards, owner) {
    this.cards = cards;
    this.owner = owner; // Player name who created this meld
    this.type = this.determineMeldType();
    this.layoffCards = new Set(); // Track which cards were laid off (stores card references)
  }

  determineMeldType() {
    if (this.isSet()) return 'set';
    if (this.isRun()) return 'run';
    return 'invalid';
  }

  isSet() {
    // Pairs (2 cards) are NOT valid sets by default - only with GEMINI upgrade
    // This check happens in createMeld() via canMeldPairs
    if (this.cards.length < config.minMeldSize || this.cards.length > config.maxSetSize) {
      return false;
    }

    const rank = this.cards[0].rank;
    return this.cards.every(card => card.rank === rank);
  }

  isPair() {
    if (this.cards.length !== 2) return false;
    return this.cards[0].rank === this.cards[1].rank;
  }

  isRun() {
    if (this.cards.length < config.minMeldSize) {
      return false;
    }

    const suit = this.cards[0].suit;
    if (!this.cards.every(card => card.suit === suit)) {
      return false;
    }

    // Sort cards by rank to check sequence
    const sortedCards = this.cards.slice().sort((a, b) => {
      return config.ranks.indexOf(a.rank) - config.ranks.indexOf(b.rank);
    });

    // Check if ranks are sequential
    for (let i = 1; i < sortedCards.length; i++) {
      const prevIndex = config.ranks.indexOf(sortedCards[i - 1].rank);
      const currIndex = config.ranks.indexOf(sortedCards[i].rank);

      if (currIndex !== prevIndex + 1) {
        return false;
      }
    }

    return true;
  }

  isValid() {
    return this.type !== 'invalid';
  }

  canLayoff(card) {
    if (this.type === 'set') {
      // Sets and pairs both accept matching rank cards
      return card.rank === this.cards[0].rank;
    }

    if (this.type === 'run') {
      const suit = this.cards[0].suit;
      if (card.suit !== suit) return false;

      // Get current rank indices
      const rankIndices = this.cards.map(c => config.ranks.indexOf(c.rank));
      const minRank = Math.min(...rankIndices);
      const maxRank = Math.max(...rankIndices);
      const cardRankIndex = config.ranks.indexOf(card.rank);

      // Card can be added if it's adjacent to either end
      return cardRankIndex === minRank - 1 || cardRankIndex === maxRank + 1;
    }

    return false;
  }

  addCard(card, isLayoff = true) {
    this.cards.push(card);
    if (isLayoff) {
      this.layoffCards.add(card);
    }
    this.sortCards();
  }

  sortCards() {
    if (this.type === 'run') {
      // Sort runs by rank
      this.cards.sort((a, b) => {
        return config.ranks.indexOf(a.rank) - config.ranks.indexOf(b.rank);
      });
    }
    // Sets don't need specific sorting, but we can sort by suit for consistency
    if (this.type === 'set') {
      this.cards.sort((a, b) => {
        return config.suits.indexOf(a.suit) - config.suits.indexOf(b.suit);
      });
    }
  }

  getValue() {
    return this.cards.reduce((sum, card) => sum + card.getValue(), 0);
  }

  // Calculate score when meld is created
  calculateMeldScore() {
    const baseScore = this.getValue();
    const modifier = this.type === 'set' ? config.setMod : config.runMod;
    return Math.round(baseScore * modifier);
  }

  // Get breakdown for display
  getMeldScoreBreakdown() {
    const baseScore = this.getValue();
    const modifier = this.type === 'set' ? config.setMod : config.runMod;
    const finalScore = Math.round(baseScore * modifier);
    return {
      baseScore,
      modifier,
      finalScore,
      type: this.type
    };
  }

  toString() {
    return this.cards.map(c => {
      const cardStr = c.toString();
      return this.layoffCards.has(c) ? `[${cardStr}]` : cardStr;
    }).join('-');
  }
}

export function validateMeld(cards, player = null) {
  // Check if it's a pair (2 cards)
  if (cards && cards.length === 2) {
    // Pairs require GEMINI upgrade
    if (!player || !player.hasUpgrade('gemini')) {
      return { valid: false, reason: 'Pairs require GEMINI upgrade' };
    }
    // Check if it's a valid pair (same rank)
    const meld = new Meld(cards, null);
    if (!meld.isPair()) {
      return { valid: false, reason: 'Two cards must have the same rank' };
    }
    return { valid: true, meld };
  }

  // Regular melds need at least 3 cards
  if (!cards || cards.length < config.minMeldSize) {
    return { valid: false, reason: 'Meld must have at least 3 cards' };
  }

  const meld = new Meld(cards, null);

  if (!meld.isValid()) {
    return { valid: false, reason: 'Cards do not form a valid set or run' };
  }

  return { valid: true, meld };
}

export function findValidLayoffs(card, melds) {
  const validLayoffs = [];

  melds.forEach((meld, index) => {
    if (meld.canLayoff(card)) {
      validLayoffs.push({
        meldIndex: index,
        meld: meld,
        owner: meld.owner
      });
    }
  });

  return validLayoffs;
}
