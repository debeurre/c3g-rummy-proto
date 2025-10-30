import config from '../config.json' with { type: 'json' };
import { Meld, findValidLayoffs } from '../meld.js';

export class SimpleAI {
  constructor(game) {
    this.game = game;
  }

  // Draw phase: pick from discard if it completes a meld, else draw from stock
  makeDrawDecision(player) {
    const topDiscard = this.game.discardPile.length > 0
      ? this.game.discardPile[this.game.discardPile.length - 1]
      : null;

    if (!topDiscard) {
      return 'stock';
    }

    // Check if taking discard would complete a meld
    const testHand = [...player.hand, topDiscard];
    const potentialMelds = this.findAllPotentialMelds(testHand);

    if (potentialMelds.length > 0) {
      return 'discard';
    }

    return 'stock';
  }

  // Meld phase: make all possible melds (runs first, then sets), layoff everything possible
  makeMeldDecisions(player) {
    const actions = [];

    // Make a copy of the hand to work with
    let remainingCards = [...player.hand];

    // Find all runs first
    const runs = this.findAllRuns(remainingCards);
    runs.forEach(meld => {
      actions.push({ type: 'meld', cards: meld.cards, meldType: 'run' });
      // Remove cards from consideration
      meld.cards.forEach(card => {
        const index = remainingCards.findIndex(c =>
          c.rank === card.rank && c.suit === card.suit
        );
        if (index !== -1) {
          remainingCards.splice(index, 1);
        }
      });
    });

    // Then find all sets
    const sets = this.findAllSets(remainingCards);
    sets.forEach(meld => {
      actions.push({ type: 'meld', cards: meld.cards, meldType: 'set' });
      // Remove cards from consideration
      meld.cards.forEach(card => {
        const index = remainingCards.findIndex(c =>
          c.rank === card.rank && c.suit === card.suit
        );
        if (index !== -1) {
          remainingCards.splice(index, 1);
        }
      });
    });

    // Now find all possible layoffs from the actual player's hand
    const allMelds = this.game.getAllMelds();
    const layoffs = [];

    player.hand.forEach(card => {
      const validLayoffs = findValidLayoffs(card, allMelds);
      if (validLayoffs.length > 0) {
        layoffs.push({ card, meldIndex: validLayoffs[0].meldIndex });
      }
    });

    layoffs.forEach(layoff => {
      actions.push({ type: 'layoff', card: layoff.card, meldIndex: layoff.meldIndex });
    });

    return actions;
  }

  // Discard phase: random choice
  makeDiscardDecision(player) {
    const randomIndex = Math.floor(Math.random() * player.hand.length);
    return player.hand[randomIndex];
  }

  // Helper: Find all potential melds in a hand
  findAllPotentialMelds(hand) {
    const runs = this.findAllRuns(hand);
    const sets = this.findAllSets(hand);
    return [...runs, ...sets];
  }

  // Helper: Find all runs in hand
  findAllRuns(hand) {
    const runs = [];
    const suits = config.suits;

    suits.forEach(suit => {
      const cardsInSuit = hand.filter(c => c.suit === suit);

      if (cardsInSuit.length < config.minMeldSize) return;

      // Sort by rank
      const sorted = cardsInSuit.sort((a, b) =>
        config.ranks.indexOf(a.rank) - config.ranks.indexOf(b.rank)
      );

      // Find consecutive sequences
      let currentRun = [sorted[0]];

      for (let i = 1; i < sorted.length; i++) {
        const prevRank = config.ranks.indexOf(sorted[i - 1].rank);
        const currRank = config.ranks.indexOf(sorted[i].rank);

        if (currRank === prevRank + 1) {
          currentRun.push(sorted[i]);
        } else {
          if (currentRun.length >= config.minMeldSize) {
            const meld = new Meld(currentRun, null);
            if (meld.isValid()) {
              runs.push(meld);
            }
          }
          currentRun = [sorted[i]];
        }
      }

      // Check final run
      if (currentRun.length >= config.minMeldSize) {
        const meld = new Meld(currentRun, null);
        if (meld.isValid()) {
          runs.push(meld);
        }
      }
    });

    return runs;
  }

  // Helper: Find all sets in hand
  findAllSets(hand) {
    const sets = [];
    const ranks = config.ranks;

    ranks.forEach(rank => {
      const cardsOfRank = hand.filter(c => c.rank === rank);

      if (cardsOfRank.length >= config.minMeldSize) {
        // Can make sets of 3 or 4
        if (cardsOfRank.length === 3 || cardsOfRank.length === 4) {
          const meld = new Meld(cardsOfRank, null);
          if (meld.isValid()) {
            sets.push(meld);
          }
        }
        // If we have 4, we could also make just 3
        // But we'll prefer the larger set
      }
    });

    return sets;
  }
}
