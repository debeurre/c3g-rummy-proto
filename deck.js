import config from './config.json' with { type: 'json' };

let cardIdCounter = 0;

export class Card {
  constructor(rank, suit) {
    this.rank = rank;
    this.suit = suit;
    this.id = cardIdCounter++; // Unique ID for each card instance
  }

  toString() {
    return `${this.rank}${this.suit}`;
  }

  getValue() {
    return config.cardValues[this.rank];
  }

  // For sorting: s-h-c-d, then A-K
  getSortValue() {
    const rankOrder = config.ranks.indexOf(this.rank);
    const suitOrder = config.suits.indexOf(this.suit);
    return suitOrder * 13 + rankOrder;
  }
}

export class Deck {
  constructor() {
    this.cards = [];
    this.initializeDeck();
  }

  initializeDeck() {
    this.cards = [];
    for (const suit of config.suits) {
      for (const rank of config.ranks) {
        this.cards.push(new Card(rank, suit));
      }
    }
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw() {
    return this.cards.pop();
  }

  size() {
    return this.cards.length;
  }

  isEmpty() {
    return this.cards.length === 0;
  }
}

// Original sort: suit-first (s-h-c-d), then rank (A-K)
export function sortHand(hand) {
  return hand.slice().sort((a, b) => a.getSortValue() - b.getSortValue());
}

// Sort by rank first, then suit
export function sortByRank(hand) {
  return hand.slice().sort((a, b) => {
    const rankOrder = config.ranks.indexOf(a.rank) - config.ranks.indexOf(b.rank);
    if (rankOrder !== 0) return rankOrder;
    return config.suits.indexOf(a.suit) - config.suits.indexOf(b.suit);
  });
}

// Sort by suit first, then rank (same as sortHand but explicit)
export function sortBySuit(hand) {
  return hand.slice().sort((a, b) => a.getSortValue() - b.getSortValue());
}

export function parseCard(cardString) {
  // Parse format like "7s" or "10h" (case insensitive)
  const normalized = cardString.toLowerCase();
  const match = normalized.match(/^([a2-9]|10|[jqk])([shcd])$/);
  if (!match) return null;

  let [, rank, suit] = match;

  // Normalize rank to uppercase for face cards and A
  rank = rank.toUpperCase();

  if (!config.ranks.includes(rank) || !config.suits.includes(suit)) {
    return null;
  }

  return new Card(rank, suit);
}

export function parseCardList(cardString) {
  // Parse format like "3s-3h-3d"
  const cardStrings = cardString.split('-');
  const cards = [];

  for (const str of cardStrings) {
    const card = parseCard(str.trim());
    if (!card) return null;
    cards.push(card);
  }

  return cards;
}
