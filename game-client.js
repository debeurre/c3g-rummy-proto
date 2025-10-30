import { GameState } from './game.js';
import { getRandomUpgrades, getUpgrade } from './upgrades.js';
import { Card, sortByRank, sortBySuit } from './deck.js';
import { SimpleAI } from './cli/ai.js';
import config from './config.json' with { type: 'json' };

class GameClient {
  constructor() {
    this.game = null;
    this.ai = null; // SimpleAI instance, initialized in startNewGame
    this.selectedCards = [];
    this.selectedMeld = null;
    this.gamePhase = 'draw'; // draw, meld, discard
    this.humanPlayerName = 'Alice';

    this.initDOM();
    this.startNewGame();
  }

  initDOM() {
    // Get DOM elements
    this.elements = {
      roundInfo: document.getElementById('round-info'),
      gameLog: document.getElementById('game-log'),
      opponents: document.getElementById('opponents'),
      meldsContainer: document.getElementById('melds-container'),
      stockPile: document.querySelector('[data-source="stock"]'),
      discardPile: document.querySelector('[data-source="discard"]'),
      stockCount: document.getElementById('stock-count'),
      reshuffleCount: document.getElementById('reshuffle-count'),
      playerName: document.getElementById('player-name'),
      playerScore: document.getElementById('player-score'),
      playerUpgrades: document.getElementById('player-upgrades'),
      playerHand: document.getElementById('player-hand'),
      playerMelds: document.getElementById('player-melds'),
      btnMeld: document.getElementById('btn-meld'),
      btnLayoff: document.getElementById('btn-layoff'),
      btnDiscard: document.getElementById('btn-discard'),
      currentPlayer: document.getElementById('current-player'),
      turnInstruction: document.getElementById('turn-instruction'),
      upgradeModal: document.getElementById('upgrade-modal'),
      upgradeChoices: document.getElementById('upgrade-choices'),
      roundEndModal: document.getElementById('round-end-modal'),
      roundEndReport: document.getElementById('round-end-report'),
      btnContinueRound: document.getElementById('btn-continue-round'),
      gameEndModal: document.getElementById('game-end-modal'),
      gameEndReport: document.getElementById('game-end-report'),
      btnNewGame: document.getElementById('btn-new-game'),
      btnSortRank: document.getElementById('btn-sort-rank'),
      btnSortSuit: document.getElementById('btn-sort-suit'),
      btnViewPile: document.getElementById('btn-view-pile'),
      discardViewer: document.getElementById('discard-pile-viewer'),
      discardViewerContent: document.querySelector('.discard-viewer-content'),
      btnReference: document.getElementById('btn-reference'),
      referenceModal: document.getElementById('reference-modal'),
      referencePageContent: document.getElementById('reference-page-content'),
      btnCloseReference: document.getElementById('btn-close-reference'),
      btnPrevPage: document.getElementById('btn-prev-page'),
      btnNextPage: document.getElementById('btn-next-page'),
      pageIndicator: document.getElementById('page-indicator')
    };

    // Reference viewer state
    this.currentReferencePage = 1;
    this.totalReferencePages = 4;

    // Attach event listeners
    this.elements.stockPile.addEventListener('click', () => this.handleDraw('stock'));
    this.elements.discardPile.addEventListener('click', () => this.handleDraw('discard'));
    this.elements.btnMeld.addEventListener('click', () => this.handleMeld());
    this.elements.btnLayoff.addEventListener('click', () => this.handleLayoff());
    this.elements.btnDiscard.addEventListener('click', () => this.handleDiscard());
    this.elements.btnContinueRound.addEventListener('click', () => this.continueAfterRound());
    this.elements.btnNewGame.addEventListener('click', () => this.startNewGame());
    this.elements.btnSortRank.addEventListener('click', () => this.handleSortByRank());
    this.elements.btnSortSuit.addEventListener('click', () => this.handleSortBySuit());

    // View pile button - show on hover/click
    this.elements.btnViewPile.addEventListener('mouseenter', () => this.showDiscardViewer());
    this.elements.btnViewPile.addEventListener('mouseleave', () => this.hideDiscardViewer());
    this.elements.btnViewPile.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDiscardViewer();
    });

    // Close viewer when clicking outside
    this.elements.discardViewer.addEventListener('click', (e) => {
      if (e.target === this.elements.discardViewer) {
        this.hideDiscardViewer();
      }
    });

    // Reference viewer events
    this.elements.btnReference.addEventListener('click', () => this.showReference());
    this.elements.btnCloseReference.addEventListener('click', () => this.closeReference());
    this.elements.btnPrevPage.addEventListener('click', () => this.prevReferencePage());
    this.elements.btnNextPage.addEventListener('click', () => this.nextReferencePage());

    // Close reference when clicking modal background
    this.elements.referenceModal.addEventListener('click', (e) => {
      if (e.target === this.elements.referenceModal) {
        this.closeReference();
      }
    });
  }

  startNewGame() {
    this.game = new GameState();
    this.ai = new SimpleAI(this.game);
    this.game.startNewRound();
    this.selectedCards = [];
    this.selectedMeld = null;
    this.gamePhase = 'draw';

    // DEBUG: Give Alice a seeded winning hand if enabled
    if (config.debugAliceWin) {
      const alice = this.game.players.find(p => p.name === this.humanPlayerName);
      if (alice) {
        alice.hand = [
          new Card('A', 's'),
          new Card('A', 'h'),
          new Card('A', 'c'),
          new Card('J', 's'),
          new Card('Q', 's'),
          new Card('K', 's'),
          new Card('10', 's')
        ];
        this.log('[DEBUG MODE] Alice given seeded hand: As Ah Ac Js Qs Ks 10s', 'log-player');
      }
    }

    // DEBUG: Give bots meldable hands if enabled
    if (config.debugBotMeld) {
      const bob = this.game.players.find(p => p.name === 'Bob');
      const charlie = this.game.players.find(p => p.name === 'Charlie');
      const dana = this.game.players.find(p => p.name === 'Dana');

      // Bob: Two runs (hearts 2-4, clubs 7-9)
      if (bob) {
        bob.hand = [
          new Card('2', 'h'),
          new Card('3', 'h'),
          new Card('4', 'h'),
          new Card('7', 'c'),
          new Card('8', 'c'),
          new Card('9', 'c'),
          new Card('K', 'd')
        ];
        this.log('[DEBUG MODE] Bob given two runs: 2h-4h, 7c-9c', 'log-ai');
      }

      // Charlie: Two sets (5s, 9s)
      if (charlie) {
        charlie.hand = [
          new Card('5', 's'),
          new Card('5', 'h'),
          new Card('5', 'c'),
          new Card('9', 's'),
          new Card('9', 'h'),
          new Card('9', 'd'),
          new Card('A', 'd')
        ];
        this.log('[DEBUG MODE] Charlie given two sets: 5s5h5c, 9s9h9d', 'log-ai');
      }

      // Dana: Set and run (Jacks set, diamonds 3-5 run)
      if (dana) {
        dana.hand = [
          new Card('J', 's'),
          new Card('J', 'h'),
          new Card('J', 'c'),
          new Card('3', 'd'),
          new Card('4', 'd'),
          new Card('5', 'd'),
          new Card('Q', 'h')
        ];
        this.log('[DEBUG MODE] Dana given set + run: JsJhJc, 3d-5d', 'log-ai');
      }
    }

    this.log('=== NEW GAME STARTED ===', 'log-score');
    this.log('Players: Alice (human), Bob, Charlie, Dana (AI)', 'log-ai');

    this.elements.upgradeModal.classList.add('hidden');
    this.elements.roundEndModal.classList.add('hidden');
    this.elements.gameEndModal.classList.add('hidden');

    this.render();
    this.updateTurnInfo();
  }

  log(message, className = 'log-entry') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${className}`;
    entry.textContent = message;
    this.elements.gameLog.appendChild(entry);
    this.elements.gameLog.scrollTop = this.elements.gameLog.scrollHeight;
  }

  render() {
    this.renderHeader();
    this.renderOpponents();
    this.renderMelds();
    this.renderPiles();
    this.renderPlayerArea();
    this.updateActionButtons();
  }

  renderHeader() {
    this.elements.roundInfo.textContent = `Round ${this.game.roundNumber}`;
  }

  renderOpponents() {
    this.elements.opponents.innerHTML = '';
    this.game.players.forEach(player => {
      if (player.name !== this.humanPlayerName) {
        const opponentDiv = document.createElement('div');
        opponentDiv.className = 'opponent';
        opponentDiv.setAttribute('data-player', player.name.toLowerCase());

        const handCards = Array(player.hand.length).fill(0).map(() =>
          '<div class="opponent-card"></div>'
        ).join('');

        // Build upgrade badges HTML
        let upgradesHTML = '';
        if (player.upgrades.length > 0 || player.carryoverMultiplier > 1.0) {
          upgradesHTML = '<div class="opponent-upgrades">';

          // Show catchup bonus if active
          if (player.carryoverMultiplier > 1.0) {
            const catchupPercent = Math.round((player.carryoverMultiplier - 1.0) * 100);
            const catchupTooltip = `Catchup Bonus\nx${player.carryoverMultiplier.toFixed(2)} score multiplier\n+${catchupPercent}% from being behind leader`;
            upgradesHTML += `<span class="upgrade-badge" title="${catchupTooltip}">🆓</span>`;
          }

          player.upgrades.forEach(upgradeId => {
            const upgrade = getUpgrade(upgradeId);
            if (upgrade) {
              let badgeText = upgrade.icon || upgrade.displayName;
              let badgeClass = 'upgrade-badge';
              if (upgradeId === 'combo_master') {
                const progress = (player.comboCount % 3) + 1; // Start from 1
                badgeText = upgrade.icon.repeat(progress); // 1-3 lightning bolts
                if (progress === 3) {
                  badgeClass += ' combo-ready';
                }
              }
              // Wildfire: grey out when used
              if (upgradeId === 'wildfire' && !player.wildfireAvailable) {
                badgeClass += ' upgrade-used';
              }
              const tooltipText = this.getUpgradeTooltip(upgradeId, player);
              const tooltip = `${upgrade.displayName}\n${upgrade.description}\n${tooltipText}`;
              upgradesHTML += `<span class="${badgeClass}" title="${tooltip}">${badgeText}</span>`;
            }
          });
          upgradesHTML += '</div>';
        }

        // Calculate total score
        const totalScores = this.game.getTotalScores();
        const opponentTotal = totalScores[player.name] || 0;

        opponentDiv.innerHTML = `
          <h4>${player.name}</h4>
          <div class="opponent-stats">
            <span>Points: ${player.points}</span>
            <span style="font-size: 0.85rem; opacity: 0.8;">Total Score: ${opponentTotal}</span>
          </div>
          ${upgradesHTML}
          <div class="opponent-hand">${handCards}</div>
        `;

        this.elements.opponents.appendChild(opponentDiv);
      }
    });
  }

  renderMelds() {
    this.elements.meldsContainer.innerHTML = '';
    const allMelds = this.game.getAllMelds();

    if (allMelds.length === 0) {
      this.elements.meldsContainer.innerHTML = '<p style="color: #aaa; font-size: 0.9rem;">No melds yet</p>';
      return;
    }

    allMelds.forEach((meld, index) => {
      const meldDiv = document.createElement('div');
      meldDiv.className = 'meld';
      meldDiv.dataset.meldIndex = index;

      if (this.gamePhase === 'layoff' && this.selectedCards.length === 1) {
        meldDiv.classList.add('selectable');
        meldDiv.addEventListener('click', () => this.selectMeldForLayoff(index));
      }

      if (this.selectedMeld === index) {
        meldDiv.classList.add('selected');
      }

      // Owner label
      const ownerSpan = document.createElement('span');
      ownerSpan.className = 'meld-owner';
      ownerSpan.textContent = meld.owner + ':';

      // Compact card display with individual colored card boxes
      const cardsContainer = document.createElement('span');
      cardsContainer.className = 'meld-cards-compact';

      meld.cards.forEach(card => {
        const cardSpan = document.createElement('span');
        cardSpan.className = `meld-card suit-${card.suit}`;

        // Add layoff indicator class
        if (meld.layoffCards.has(card)) {
          cardSpan.classList.add('meld-card-layoff');
        }

        cardSpan.textContent = this.formatCardForDisplay(card);
        cardsContainer.appendChild(cardSpan);
      });

      meldDiv.appendChild(ownerSpan);
      meldDiv.appendChild(cardsContainer);
      this.elements.meldsContainer.appendChild(meldDiv);
    });
  }

  renderPiles() {
    const stockSize = this.game.stock.cards.length;
    this.elements.stockCount.textContent = `${stockSize} cards left`;
    const remainingReshuffles = 2 - this.game.reshuffleCount;
    this.elements.reshuffleCount.textContent = `Reshuffles left: ${remainingReshuffles}`;

    // Render discard pile - placeholder is always visible, cards go on top
    const discardSlot = document.querySelector('.discard-card-slot');
    if (this.game.discardPile.length > 0) {
      const topCard = this.game.discardPile[this.game.discardPile.length - 1];
      discardSlot.innerHTML = '';
      const cardDiv = this.createCardElement(topCard, false);
      discardSlot.appendChild(cardDiv);
    } else {
      discardSlot.innerHTML = '';
    }
  }

  renderPlayerArea() {
    const player = this.game.players.find(p => p.name === this.humanPlayerName);

    this.elements.playerScore.textContent = `Points: ${player.points}`;

    // Calculate and display total score across all rounds
    const totalScores = this.game.getTotalScores();
    const playerTotal = totalScores[player.name] || 0;
    const totalElement = document.getElementById('player-total');
    if (totalElement) {
      totalElement.textContent = `Total Score: ${playerTotal}`;
    }

    // Render upgrades
    this.elements.playerUpgrades.innerHTML = '';

    // Show catchup bonus if active
    if (player.carryoverMultiplier > 1.0) {
      const catchupPercent = Math.round((player.carryoverMultiplier - 1.0) * 100);
      const catchupBadge = document.createElement('span');
      catchupBadge.className = 'upgrade-badge';
      catchupBadge.textContent = '🆓';
      catchupBadge.title = `Catchup Bonus\nx${player.carryoverMultiplier.toFixed(2)} score multiplier\n+${catchupPercent}% from being behind leader`;
      this.elements.playerUpgrades.appendChild(catchupBadge);
    }

    player.upgrades.forEach(upgradeId => {
      const upgrade = getUpgrade(upgradeId);
      if (upgrade) {
        const badge = document.createElement('span');
        badge.className = 'upgrade-badge';

        // Add combo counter for Combo Master
        if (upgradeId === 'combo_master') {
          const progress = (player.comboCount % 3) + 1; // Start from 1
          badge.textContent = upgrade.icon.repeat(progress); // 1-3 lightning bolts
          if (progress === 3) {
            badge.classList.add('combo-ready');
          }
        } else {
          badge.textContent = upgrade.icon || upgrade.displayName;
        }

        // Wildfire: grey out when used
        if (upgradeId === 'wildfire' && !player.wildfireAvailable) {
          badge.classList.add('upgrade-used');
        }

        const tooltipText = this.getUpgradeTooltip(upgradeId, player);
        badge.title = `${upgrade.displayName}\n${upgrade.description}\n${tooltipText}`;
        this.elements.playerUpgrades.appendChild(badge);
      }
    });

    // Render hand
    this.elements.playerHand.innerHTML = '';
    player.hand.forEach(card => {
      const cardDiv = this.createCardElement(card, true);
      cardDiv.addEventListener('click', () => this.toggleCardSelection(card, player));

      if (this.selectedCards.some(c => c.id === card.id)) {
        cardDiv.classList.add('selected');
      }

      this.elements.playerHand.appendChild(cardDiv);
    });
  }

  createCardElement(card, clickable = true) {
    const cardDiv = document.createElement('div');
    cardDiv.className = `card suit-${card.suit}`;
    cardDiv.textContent = this.formatCardForDisplay(card);

    if (!clickable) {
      cardDiv.style.cursor = 'default';
    }

    return cardDiv;
  }

  formatCardForDisplay(card) {
    const suitSymbols = {
      's': '♠',
      'h': '♥',
      'c': '♣',
      'd': '♦'
    };
    return `${card.rank}${suitSymbols[card.suit]}`;
  }

  toggleCardSelection(card, player) {
    const index = this.selectedCards.findIndex(c => c.id === card.id);
    if (index > -1) {
      this.selectedCards.splice(index, 1);
    } else {
      this.selectedCards.push(card);
    }
    this.renderPlayerArea();
    this.updateActionButtons();
  }

  selectMeldForLayoff(meldIndex) {
    if (this.selectedCards.length !== 1) {
      this.log('Select exactly 1 card to layoff', 'log-error');
      return;
    }

    const card = this.selectedCards[0];
    const result = this.game.layoff(card, meldIndex);

    if (result.success) {
      const sb = result.scoreBreakdown;
      let scoreMsg = `${sb.finalScore} = ${sb.baseScore}`;
      if (sb.baseMod) scoreMsg += ` + ${sb.baseMod}`;
      scoreMsg += ` x ${sb.modifier.toFixed(1)}`;
      if (sb.upgradeMult && sb.upgradeMult !== 1.0) {
        scoreMsg += ` x ${sb.upgradeMult.toFixed(2)}`;
      }
      if (sb.comboBonus) {
        scoreMsg += ` + COMBO! (+${sb.comboBonus})`;
      }

      this.log(`Laid off ${this.formatCardForDisplay(card)} (${scoreMsg})`, 'log-score');
      this.selectedCards = [];
      this.selectedMeld = null;
      this.gamePhase = 'meld';

      // Check if round ended from layoff
      if (result.playerWon) {
        setTimeout(() => this.endRoundFlow(), 500);
        return;
      }

      this.render();
      this.updateTurnInfo();
    } else {
      this.log(result.reason, 'log-error');
    }
  }

  updateActionButtons() {
    const isHumanTurn = this.game.getCurrentPlayer().name === this.humanPlayerName;

    // Meld button: enabled if 2+ cards selected and in meld phase
    this.elements.btnMeld.disabled = !(isHumanTurn && this.selectedCards.length >= 2 && this.gamePhase === 'meld');

    // Layoff button: changes to "Cancel" in layoff mode
    if (this.gamePhase === 'layoff') {
      this.elements.btnLayoff.textContent = 'Cancel';
      this.elements.btnLayoff.disabled = false;
    } else {
      this.elements.btnLayoff.textContent = 'Layoff';

      // Check if there's actually a valid layoff available
      let hasValidLayoff = false;
      if (isHumanTurn && this.selectedCards.length === 1 && this.gamePhase === 'meld') {
        const card = this.selectedCards[0];
        const allMelds = this.game.getAllMelds();
        hasValidLayoff = allMelds.some(meld => meld.canLayoff(card));
      }

      this.elements.btnLayoff.disabled = !hasValidLayoff;
    }

    // Discard button: enabled if 1 card selected and in meld phase
    this.elements.btnDiscard.disabled = !(isHumanTurn && this.selectedCards.length === 1 && this.gamePhase === 'meld');
  }

  updateTurnInfo() {
    const currentPlayer = this.game.getCurrentPlayer();
    this.elements.currentPlayer.textContent = `${currentPlayer.name}'s Turn`;

    if (currentPlayer.name === this.humanPlayerName) {
      if (this.gamePhase === 'draw') {
        this.elements.turnInstruction.textContent = 'Draw a card from stock or discard pile';
      } else if (this.gamePhase === 'layoff') {
        this.elements.turnInstruction.textContent = 'Select 1 card, then click a meld to layoff';
      } else {
        this.elements.turnInstruction.textContent = 'Meld, layoff, or discard to end turn';
      }
    } else {
      this.elements.turnInstruction.textContent = 'AI is thinking...';
      setTimeout(() => this.playAITurn(), 800);
    }
  }

  handleDraw(source) {
    if (this.gamePhase !== 'draw') {
      this.log('You must discard first!', 'log-error');
      return;
    }

    const player = this.game.getCurrentPlayer();
    if (player.name !== this.humanPlayerName) {
      return;
    }

    if (source === 'stock') {
      const result = this.game.drawFromStock();

      if (result.stalemate) {
        this.log('Stock depleted - Stalemate!', 'log-error');
        setTimeout(() => this.stalemateFlow(), 500);
        return;
      }

      if (result.card) {
        this.log(`${player.name} drew from stock`, 'log-player');
        this.gamePhase = 'meld';
        this.selectedCards = [];
        this.render();
        this.updateTurnInfo();
      }
    } else {
      const card = this.game.drawFromDiscard();
      if (card) {
        this.log(`${player.name} drew from discard`, 'log-player');
        this.gamePhase = 'meld';
        this.selectedCards = [];
        this.render();
        this.updateTurnInfo();
      } else {
        this.log(`Cannot draw from ${source}`, 'log-error');
      }
    }
  }

  handleMeld() {
    if (this.selectedCards.length < 2) {
      this.log('Select at least 2 cards to meld', 'log-error');
      return;
    }

    const result = this.game.createMeld(this.selectedCards);
    if (result.success) {
      const sb = result.scoreBreakdown;
      let scoreMsg = `${sb.finalScore} = ${sb.baseScore}`;
      if (sb.baseMod) scoreMsg += ` + ${sb.baseMod}`;
      scoreMsg += ` x ${sb.modifier.toFixed(1)}`;
      if (sb.upgradeMult && sb.upgradeMult !== 1.0) {
        scoreMsg += ` x ${sb.upgradeMult.toFixed(2)}`;
      }
      if (sb.comboBonus) {
        scoreMsg += ` + COMBO! (+${sb.comboBonus})`;
      }

      this.log(`Melded ${result.meld.toString()} (${scoreMsg})`, 'log-score');
      this.selectedCards = [];

      // Check if round ended from meld
      if (result.playerWon) {
        setTimeout(() => this.endRoundFlow(), 500);
        return;
      }

      this.render();
      this.updateTurnInfo();
    } else {
      this.log(result.reason, 'log-error');
    }
  }

  handleLayoff() {
    if (this.gamePhase === 'layoff') {
      // Cancel layoff mode
      this.gamePhase = 'meld';
      this.selectedMeld = null;
      this.render();
      this.updateTurnInfo();
    } else {
      // Enter layoff mode
      if (this.selectedCards.length !== 1) {
        this.log('Select exactly 1 card to layoff', 'log-error');
        return;
      }
      this.gamePhase = 'layoff';
      this.selectedMeld = null;
      this.render();
      this.updateTurnInfo();
    }
  }

  handleDiscard() {
    if (this.selectedCards.length !== 1) {
      this.log('Select exactly 1 card to discard', 'log-error');
      return;
    }

    const card = this.selectedCards[0];
    const player = this.game.getCurrentPlayer();
    const result = this.game.discard(card);
    this.log(`${player.name} discarded ${this.formatCardForDisplay(card)}`, 'log-player');

    this.selectedCards = [];
    this.gamePhase = 'draw';

    // Check if round ended
    if (result.playerWon) {
      setTimeout(() => this.endRoundFlow(), 500);
      return;
    }

    // Advance to next player
    this.game.nextPlayer();
    this.render();
    this.updateTurnInfo();
  }

  playAITurn() {
    const player = this.game.getCurrentPlayer();

    // Draw from stock
    const result = this.game.drawFromStock();

    if (result.stalemate) {
      this.log('Stock depleted - Stalemate!', 'log-error');
      setTimeout(() => this.stalemateFlow(), 500);
      return;
    }

    if (!result.card) {
      // Shouldn't happen, but safety check
      this.log(`${player.name} could not draw`, 'log-error');
      return;
    }

    this.log(`${player.name} drew from stock`, 'log-ai');

    // Use smart AI to find all possible melds
    const potentialMelds = this.ai.findAllPotentialMelds(player.hand);

    for (const meld of potentialMelds) {
      const result = this.game.createMeld(meld.cards);
      if (result.success) {
        this.log(`${player.name} melded ${result.meld.toString()} (+${result.scoreBreakdown.finalScore})`, 'log-ai');

        // Check if round ended from meld
        if (result.playerWon) {
          setTimeout(() => this.endRoundFlow(), 500);
          return;
        }
      }
    }

    // Try to layoff cards
    const handCopy = [...player.hand];
    const allMelds = this.game.getAllMelds();
    for (const card of handCopy) {
      for (let index = 0; index < allMelds.length; index++) {
        const meld = allMelds[index];
        if (meld.canLayoff(card) && player.hand.some(c => c.rank === card.rank && c.suit === card.suit)) {
          const result = this.game.layoff(card, index);
          if (result.success) {
            this.log(`${player.name} laid off ${this.formatCardForDisplay(card)} (+${result.scoreBreakdown.finalScore})`, 'log-ai');

            // Check if round ended from layoff
            if (result.playerWon) {
              setTimeout(() => this.endRoundFlow(), 500);
              return;
            }
          }
        }
      }
    }

    // Discard random card
    if (player.hand.length > 0) {
      const randomCard = player.hand[Math.floor(Math.random() * player.hand.length)];
      const result = this.game.discard(randomCard);
      this.log(`${player.name} discarded ${this.formatCardForDisplay(randomCard)}`, 'log-ai');

      if (result.playerWon) {
        setTimeout(() => this.endRoundFlow(), 500);
        return;
      }
    }

    // Advance to next player
    this.game.nextPlayer();
    this.render();
    this.updateTurnInfo();
  }

  // ONE place where endRound() is called - orchestrates round end flow
  endRoundFlow() {
    const winner = this.game.getCurrentPlayer();
    this.log(`=== ${winner.name} went out! ===`, 'log-score');

    const currentRound = this.game.roundNumber; // Capture current round number
    const result = this.game.endRound(); // This increments roundNumber

    // Build report
    const report = [];
    this.game.players.forEach(player => {
      const details = result.bonusDetails[player.name];
      report.push({
        player: player.name,
        roundPoints: details.roundPoints,
        bonuses: details,
        finalScore: details.finalScore
      });
    });

    // Show round end modal
    this.elements.roundEndReport.innerHTML = this.generateRoundReport(report, winner, currentRound);
    this.renderScoreProgressionChart();
    document.getElementById('standings-container').innerHTML = this.generateStandings();
    this.elements.roundEndModal.classList.remove('hidden');
  }

  // ONE place where endRoundStalemate() is called - orchestrates stalemate flow
  stalemateFlow() {
    this.log('=== STALEMATE - No winner ===', 'log-error');

    const currentRound = this.game.roundNumber; // Capture current round number
    const result = this.game.endRoundStalemate(); // This increments roundNumber

    // Build report just like normal round but note it's a stalemate
    const report = [];
    this.game.players.forEach(player => {
      const details = result.bonusDetails[player.name];
      report.push({
        player: player.name,
        roundPoints: details.roundPoints,
        bonuses: details,
        finalScore: details.finalScore
      });
    });

    let html = `<p><strong>Round ${currentRound} ended in STALEMATE</strong></p>`;
    html += '<p><em>Stock depleted after max reshuffles. No win or deadwood bonuses.</em></p>';

    // Use normal report table generation
    html += '<table class="report-table">';

    // Header row
    html += '<tr><th></th>';
    report.forEach(entry => {
      html += `<th>${entry.player}</th>`;
    });
    html += '</tr>';

    // Round points row
    html += '<tr><th title="Points earned from melds and layoffs this round">Round Points</th>';
    report.forEach(entry => {
      html += `<td>${entry.roundPoints || 0}</td>`;
    });
    html += '</tr>';

    // Collect multipliers (no flat bonuses on stalemate)
    const allMultipliers = new Set();
    report.forEach(entry => {
      entry.bonuses.multipliers.forEach(b => allMultipliers.add(b.name));
    });

    // Multiplier rows
    allMultipliers.forEach(bonusName => {
      const tooltip = this.getBonusTooltip(bonusName);
      html += `<tr><th title="${tooltip}">${bonusName}</th>`;
      report.forEach(entry => {
        const multBonus = entry.bonuses.multipliers.find(b => b.name === bonusName);
        if (multBonus) {
          html += `<td>x${multBonus.value.toFixed(2)}</td>`;
        } else {
          html += '<td>-</td>';
        }
      });
      html += '</tr>';
    });

    // Final Score row
    html += '<tr><th><strong>Final Score</strong></th>';
    report.forEach(entry => {
      html += `<td><strong>${entry.finalScore}</strong></td>`;
    });
    html += '</tr>';
    html += '</table>';

    this.elements.roundEndReport.innerHTML = html;
    this.renderScoreProgressionChart();
    document.getElementById('standings-container').innerHTML = this.generateStandings();
    this.elements.roundEndModal.classList.remove('hidden');
  }

  getBonusTooltip(bonusName) {
    const tooltips = {
      'Win Bonus': 'Winner only: +30 flat points',
      'Deadwood Bonus': 'Winner only: Total opponent deadwood ÷ 10 (max 20)',
      'Overflow Bonus': 'Emptied hand before discard: +10 flat points',
      'Alchemist': 'x(1 + 0.5 per meld + 0.1 per layoff)',
      'Hut Hike': 'Melded set AND run: x2.5 multiplier',
      'Marathon': '2+ runs melded: x2.0 multiplier',
      'Slot Machine': '2+ sets melded: x3.0 multiplier',
      'Hexagram': '3+ pairs melded: x2.0 multiplier',
      'Catchup Bonus': 'Behind total score leader: x(1 + 0.5% per point deficit)'
    };
    return tooltips[bonusName] || '';
  }

  getUpgradeTooltip(upgradeId, player) {
    const upgrade = getUpgrade(upgradeId);
    if (!upgrade) return '';

    let tooltip = upgrade.tooltip;

    // Dynamic X values for scaling upgrades
    if (upgradeId === 'recycling_plant' && player) {
      const currentX = player.recyclingPlantBonus || 0;
      tooltip = `X starts at 0 each round. +1 per discard. Added to base before multipliers. (Current: +${currentX})`;
    } else if (upgradeId === 'evo_scale' && player) {
      const currentMult = player.upgradeMultipliers?.all || 1.0;
      tooltip = `Starts at x1.5. Grows by x0.5 every round. Applied after action multipliers. (Current: x${currentMult.toFixed(1)})`;
    } else if (upgradeId === 'evo_base' && player) {
      const rounds = (player.evoBaseWins || 0) + (player.evoBaseLosses || 0);
      const currentBonus = 10 + (rounds * 5);
      tooltip = `Starts at +10. Grows by +5 every round. Added to base before multipliers. (Current: +${currentBonus})`;
    }

    return tooltip;
  }

  renderScoreProgressionChart() {
    // Destroy existing chart if it exists
    if (this.scoreChart) {
      this.scoreChart.destroy();
    }

    const canvas = document.getElementById('score-progression-chart');
    if (!canvas) return;

    // Build cumulative score data for each player across rounds
    const playerColors = {
      'Alice': '#c65d47',  // Warm terracotta
      'Bob': '#7fa650',    // Sage green
      'Charlie': '#457ca5', // Lighter blue
      'Dana': '#d4a574'    // Golden tan
    };

    const datasets = this.game.players.map(player => {
      const scores = [0]; // Start at 0
      this.game.scoreHistory.forEach(round => {
        const lastScore = scores[scores.length - 1];
        scores.push(lastScore + (round.scores[player.name] || 0));
      });

      return {
        label: player.name,
        data: scores,
        borderColor: playerColors[player.name] || '#666',
        backgroundColor: playerColors[player.name] || '#666',
        borderWidth: 3,
        tension: 0.2,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: playerColors[player.name] || '#666',
        pointBorderColor: '#f5f1e8',
        pointBorderWidth: 2
      };
    });

    const labels = Array.from({ length: this.game.scoreHistory.length + 1 }, (_, i) =>
      i === 0 ? 'Start' : `R${i}`
    );

    this.scoreChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.5,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#f5f1e8',
              font: {
                size: 14,
                weight: 'bold'
              },
              padding: 15,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          title: {
            display: true,
            text: 'Score Progression',
            color: '#f5f1e8',
            font: {
              size: 16,
              weight: 'bold'
            },
            padding: {
              top: 10,
              bottom: 20
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: '#e8dcc4',
              font: {
                size: 12
              }
            },
            grid: {
              color: 'rgba(212, 196, 168, 0.3)'
            }
          },
          x: {
            ticks: {
              color: '#e8dcc4',
              font: {
                size: 12
              }
            },
            grid: {
              color: 'rgba(212, 196, 168, 0.3)'
            }
          }
        }
      }
    });
  }

  generateRoundReport(report, winner, roundNum) {
    let html = `<p><strong>${winner.name} wins round ${roundNum}!</strong></p>`;
    html += '<table class="report-table">';

    // Header row: empty cell + player names
    html += '<tr><th></th>';
    report.forEach(entry => {
      const isWinner = entry.player === winner.name;
      const headerClass = isWinner ? 'winner-col' : '';
      html += `<th class="${headerClass}">${entry.player}</th>`;
    });
    html += '</tr>';

    // Points row (round points from melds/layoffs)
    html += '<tr><th title="Points earned from melds and layoffs this round">Round Points</th>';
    report.forEach(entry => {
      html += `<td>${entry.roundPoints || 0}</td>`;
    });
    html += '</tr>';

    // Collect all flat bonuses and multipliers separately to maintain order
    const allFlatBonuses = new Set();
    const allMultipliers = new Set();
    report.forEach(entry => {
      entry.bonuses.flatBonuses.forEach(b => allFlatBonuses.add(b.name));
      entry.bonuses.multipliers.forEach(b => allMultipliers.add(b.name));
    });

    // Flat bonus rows first
    allFlatBonuses.forEach(bonusName => {
      const tooltip = this.getBonusTooltip(bonusName);
      html += `<tr><th title="${tooltip}">${bonusName}</th>`;
      report.forEach(entry => {
        const flatBonus = entry.bonuses.flatBonuses.find(b => b.name === bonusName);
        if (flatBonus) {
          html += `<td>+${flatBonus.value}</td>`;
        } else {
          html += '<td>-</td>';
        }
      });
      html += '</tr>';
    });

    // Multiplier rows second
    allMultipliers.forEach(bonusName => {
      const tooltip = this.getBonusTooltip(bonusName);
      html += `<tr><th title="${tooltip}">${bonusName}</th>`;
      report.forEach(entry => {
        const multBonus = entry.bonuses.multipliers.find(b => b.name === bonusName);
        if (multBonus) {
          html += `<td>x${multBonus.value.toFixed(2)}</td>`;
        } else {
          html += '<td>-</td>';
        }
      });
      html += '</tr>';
    });

    // Final Score row
    html += '<tr><th title="(Round Points + Flat Bonuses) × All Multipliers"><strong>Final Score</strong></th>';
    report.forEach(entry => {
      const finalScore = entry.finalScore || 0;
      html += `<td><strong>${finalScore}</strong></td>`;
    });
    html += '</tr>';

    html += '</table>';

    return html;
  }

  generateStandings() {
    const totalScores = this.game.getTotalScores();
    const standings = Object.entries(totalScores)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total); // Sort by total score descending

    let html = '<div class="standings-section">';
    html += '<h3 style="margin-bottom: 0.5rem; color: #f5f1e8;">Current Standings</h3>';
    html += '<table class="report-table" style="font-size: 0.9rem;">';
    standings.forEach((entry, index) => {
      const rank = index + 1;
      const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      const rowClass = entry.name === this.humanPlayerName ? 'winner-col' : '';
      html += `<tr class="${rowClass}"><td style="text-align: center; width: 3rem;">${rankEmoji}</td><td>${entry.name}</td><td style="text-align: right;"><strong>${entry.total}</strong></td></tr>`;
    });
    html += '</table>';
    html += '</div>';

    return html;
  }

  continueAfterRound() {
    this.elements.roundEndModal.classList.add('hidden');

    // Check for game end (after 5 rounds)
    if (this.game.roundNumber > 5) {
      this.handleGameEnd();
      return;
    }

    // Show upgrade selection
    this.showUpgradeSelection();
  }

  showUpgradeSelection() {
    const player = this.game.players.find(p => p.name === this.humanPlayerName);
    const upgrades = getRandomUpgrades(3, player.upgrades);

    this.elements.upgradeChoices.innerHTML = '';
    upgrades.forEach(upgrade => {
      const optionDiv = document.createElement('div');
      optionDiv.className = 'upgrade-option';
      const tooltipText = this.getUpgradeTooltip(upgrade.id, player);
      optionDiv.innerHTML = `
        <h3>${upgrade.icon} ${upgrade.displayName}</h3>
        <p>${upgrade.description}</p>
        <p class="upgrade-tooltip">${tooltipText}</p>
      `;
      optionDiv.addEventListener('click', () => this.selectUpgrade(upgrade.id));
      this.elements.upgradeChoices.appendChild(optionDiv);
    });

    this.elements.upgradeModal.classList.remove('hidden');
  }

  selectUpgrade(upgradeId) {
    const player = this.game.players.find(p => p.name === this.humanPlayerName);
    this.game.applyUpgrade(player, upgradeId);

    const upgrade = getUpgrade(upgradeId);
    this.log(`${player.name} selected upgrade: ${upgrade.displayName}`, 'log-score');

    // AI players select random upgrades
    this.game.players.forEach(p => {
      if (p.name !== this.humanPlayerName) {
        const aiUpgrades = getRandomUpgrades(3, p.upgrades);
        if (aiUpgrades.length > 0) {
          const selected = aiUpgrades[Math.floor(Math.random() * aiUpgrades.length)];
          this.game.applyUpgrade(p, selected.id);
          this.log(`${p.name} selected upgrade: ${selected.displayName}`, 'log-ai');
        }
      }
    });

    this.elements.upgradeModal.classList.add('hidden');

    // Start next round
    this.game.startNewRound();
    this.gamePhase = 'draw';
    this.selectedCards = [];
    this.selectedMeld = null;

    this.log(`\n=== ROUND ${this.game.roundNumber} ===`, 'log-score');
    this.render();
    this.updateTurnInfo();
  }

  handleGameEnd() {
    const totalScores = this.game.getTotalScores();
    const sorted = [...this.game.players].sort((a, b) => totalScores[b.name] - totalScores[a.name]);
    const winner = sorted[0];

    let html = `<h3>${winner.name} wins the game!</h3>`;
    html += '<table class="report-table">';
    html += '<tr><th>Rank</th><th>Player</th><th>Final Score</th></tr>';

    sorted.forEach((player, index) => {
      const rowClass = index === 0 ? 'winner-row' : '';
      html += `<tr class="${rowClass}">
        <td>${index + 1}</td>
        <td>${player.name}</td>
        <td><strong>${totalScores[player.name]}</strong></td>
      </tr>`;
    });

    html += '</table>';
    this.elements.gameEndReport.innerHTML = html;
    this.elements.gameEndModal.classList.remove('hidden');
  }

  viewState() {
    this.log('\n=== CURRENT GAME STATE ===', 'log-score');
    const totalScores = this.game.getTotalScores();
    this.game.players.forEach(player => {
      this.log(`${player.name}: Hand=${player.hand.length} Total=${totalScores[player.name]} Points=${player.points}`, 'log-ai');
    });
    const allMelds = this.game.getAllMelds();
    this.log(`Melds on table: ${allMelds.length}`, 'log-ai');
    this.log('========================\n', 'log-score');
  }

  handleSortByRank() {
    const player = this.game.players.find(p => p.name === this.humanPlayerName);
    if (player) {
      player.hand = sortByRank(player.hand);
      this.renderPlayerArea();
      this.log('Hand sorted by rank', 'log-player');
    }
  }

  handleSortBySuit() {
    const player = this.game.players.find(p => p.name === this.humanPlayerName);
    if (player) {
      player.hand = sortBySuit(player.hand);
      this.renderPlayerArea();
      this.log('Hand sorted by suit', 'log-player');
    }
  }

  showDiscardViewer() {
    if (this.game.discardPile.length <= 1) {
      return; // Only top card, nothing to show
    }

    // Get all cards except the top one (which is visible on the pile)
    const cardsToShow = this.game.discardPile.slice(0, -1);

    // Sort cards by suit then rank for easier scanning
    const sortedCards = sortBySuit([...cardsToShow]);

    // Clear and populate viewer
    this.elements.discardViewerContent.innerHTML = '';
    sortedCards.forEach(card => {
      const miniCard = document.createElement('div');
      miniCard.className = `mini-card suit-${card.suit}`;
      miniCard.textContent = this.formatCardForDisplay(card);
      this.elements.discardViewerContent.appendChild(miniCard);
    });

    this.elements.discardViewer.classList.remove('hidden');
  }

  hideDiscardViewer() {
    this.elements.discardViewer.classList.add('hidden');
  }

  toggleDiscardViewer() {
    if (this.elements.discardViewer.classList.contains('hidden')) {
      this.showDiscardViewer();
    } else {
      this.hideDiscardViewer();
    }
  }

  // Reference viewer methods
  getReferencePage(pageNum) {
    const pages = {
      1: `
        <h2>Quick Reference - Overview</h2>
        <h3>INTRO</h3>
        <p>Welcome! This is a prototype for a fast-paced Rummy variant where you score points, earn upgrades, and compete for the highest score. Each round takes 2-3 minutes.</p>

        <h3>GOAL</h3>
        <p><strong>Highest score after 5 rounds wins</strong></p>

        <h3>ROUND LOOP</h3>
        <ol>
          <li><strong>Draw</strong> a card from stock or discard pile</li>
          <li><strong>Meld</strong> sets (3+ same rank) or runs (3+ same suit in sequence)</li>
          <li><strong>Layoff</strong> cards onto anyone's melds for extra points</li>
          <li><strong>Discard</strong> a card to end your turn</li>
          <li><strong>First to empty hand wins the round</strong> and scores bonuses</li>
        </ol>

        <h3>AFTER EACH ROUND</h3>
        <ul>
          <li>Round end bonuses for performance apply to all scores, not just the winner</li>
          <li>Everyone chooses <strong>1 of 3 random upgrades</strong></li>
          <li>Upgrades enhance scoring and unlock new strategies</li>
        </ul>

        <h3>KEY POINTS</h3>
        <ul>
          <li>Every round matters - comebacks are possible through bonuses</li>
          <li>Points from melds are scored immediately</li>
          <li>Upgrades stack and create powerful combos</li>
          <li>Discard pile visible - plan your draws strategically</li>
        </ul>
      `,
      2: `
        <h2>Quick Reference - Phases</h2>
        <h3>DRAW PHASE</h3>
        <p>Pick one:</p>
        <ul>
          <li><strong>Stock pile</strong> (face-down) - mystery card</li>
          <li><strong>Discard pile</strong> (face-up) - top card only, visible to all</li>
        </ul>
        <p>After drawing, you move to the action phase.</p>

        <h3>ACTION PHASE</h3>
        <p>You can do <strong>any or all</strong> of these, in any order:</p>
        <ul>
          <li><strong>Meld:</strong> Play 3+ cards forming a set or run
            <ul>
              <li><strong>Set:</strong> Same rank, different suits (e.g., 7♠ 7♥ 7♣)</li>
              <li><strong>Run:</strong> Same suit, sequential ranks (e.g., 4♦ 5♦ 6♦)</li>
              <li>Score points immediately when you meld</li>
            </ul>
          </li>
          <li><strong>Layoff:</strong> Add cards to ANY player's melds (including your own)
            <ul>
              <li>Extend runs: add to either end</li>
              <li>Expand sets: add matching rank</li>
              <li>Score points for each layoff</li>
            </ul>
          </li>
        </ul>

        <h3>DISCARD PHASE</h3>
        <ul>
          <li><strong>Must</strong> discard exactly 1 card to end your turn</li>
          <li><strong>Win condition:</strong> If you have 0 cards after discarding, you earn a +30 round win bonus</li>
          <li><strong>Overflow win:</strong> If you empty your hand during melding/layoff (before discard), you get a +10 bonus</li>
        </ul>

        <h3>SPECIAL RULES</h3>
        <ul>
          <li>Stock depletes? Reshuffle discard pile into stock (max 2 reshuffles)</li>
          <li>Third reshuffle needed? Stalemate - round ends, multipliers apply but no win/deadwood bonuses</li>
        </ul>
      `,
      3: `
        <h2>Quick Reference - Upgrades</h2>
        <p>After each round, players pick upgrades that modify scoring and unlock new strategies.</p>

        <h3>HOW UPGRADES WORK</h3>
        <ul>
          <li>After each round, everyone chooses 1 upgrade</li>
          <li>Each player sees their own 3 random options (not a shared pool)</li>
          <li><strong>Upgrades are permanent</strong> for the rest of the game</li>
          <li><strong>No duplicates</strong> - can't pick the same upgrade twice</li>
        </ul>

        <h3>SAMPLE UPGRADES</h3>
        <h4>Score Multipliers:</h4>
        <ul>
          <li><strong>WILDFIRE:</strong> First meld each round scores x5</li>
          <li><strong>EVO SCALE:</strong> x1.5 to all actions, grows by x0.5 each round</li>
          <li><strong>FACE CARDS:</strong> J/Q/K worth 20 instead of 10</li>
        </ul>

        <h4>Flat Bonuses:</h4>
        <ul>
          <li><strong>EVO BASE:</strong> +10 to all actions, grows by +5 each round</li>
          <li><strong>RECYCLING PLANT:</strong> +X to all actions, X grows by 1 per discard</li>
        </ul>

        <h4>Combo Builders:</h4>
        <ul>
          <li><strong>COMBO MASTER:</strong> Every 3rd meld/layoff gives +50 bonus</li>
          <li><strong>GEMINI:</strong> Unlock pairs (2 matching cards) as valid melds
            <ul><li>Pairs score x2. Meld 3+ pairs in a round → <strong>Hexagram</strong> (x2 multiplier)</li></ul>
          </li>
        </ul>
      `,
      4: `
        <h2>Quick Reference - Scoring & Edge Cases</h2>
        <h3>SCORING FORMULA</h3>
        <pre>Base Score = Card Values + Card Upgrades
Action Score = (Base Score + Base Bonuses) × Action Mult × Upgrade Mult
Round-End Score = (Running Score + Flat Bonuses) × Round Multipliers

Action Mults: Sets ×3.0, Runs ×2.0, Pairs ×2.0, Layoffs ×1.5</pre>

        <h3>FLAT BONUSES (added to score)</h3>
        <ul>
          <li><strong>Win Bonus:</strong> +30 (winner only)</li>
          <li><strong>Deadwood Bonus:</strong> Opponent deadwood ÷ 10, max +20 (winner only)</li>
          <li><strong>Overflow Bonus:</strong> +10 if you emptied hand before discard</li>
        </ul>

        <h3>MULTIPLIERS (multiply score)</h3>
        <ul>
          <li><strong>Alchemist:</strong> ×(1 + 0.5 per meld + 0.1 per layoff) - always active if you melded or laid off</li>
          <li><strong>Hut Hike:</strong> ×2.5 if you melded both a set AND a run</li>
          <li><strong>Marathon:</strong> ×2.0 if you melded 2+ runs</li>
          <li><strong>Slot Machine:</strong> ×3.0 if you melded 2+ sets</li>
          <li><strong>Hexagram:</strong> ×2.0 if you melded 3+ pairs (requires GEMINI)</li>
          <li><strong>Catchup Bonus:</strong> ×(1 + 0.5% per point behind total score leader) - uncapped</li>
        </ul>

        <h3>CARD VALUES</h3>
        <ul>
          <li><strong>A:</strong> 11 points</li>
          <li><strong>2-10:</strong> Face value</li>
          <li><strong>J/Q/K:</strong> 10 points (20 with FACE CARDS upgrade)</li>
        </ul>

        <h3>EDGE CASES</h3>
        <ul>
          <li><strong>Empty hand during meld/layoff?</strong> You win immediately (earn Overflow Bonus)</li>
          <li><strong>Stalemate?</strong> Round points with multipliers applied, but no win/deadwood bonuses, then proceed to upgrades</li>
          <li><strong>Tie for highest score?</strong> Tiebreaker: most round wins, then highest single-round score</li>
          <li><strong>Can't meld pairs?</strong> Need GEMINI upgrade first</li>
          <li><strong>Drawing from empty stock?</strong> Auto-reshuffles once, max 2 reshuffles total</li>
        </ul>

        <h3>DEADWOOD</h3>
        <p>Cards left in hand at round end = deadwood</p>
        <ul>
          <li><strong>Winner:</strong> Scores bonus from opponent deadwood</li>
          <li><strong>Losers:</strong> No penalty directly, but winner benefits from your deadwood</li>
          <li><strong>Catchup:</strong> Players behind the total score leader get next-round multiplier based on their deficit</li>
        </ul>
      `
    };
    return pages[pageNum] || '';
  }

  showReference() {
    this.currentReferencePage = 1;
    this.renderReferencePage();
    this.elements.referenceModal.classList.remove('hidden');
  }

  closeReference() {
    this.elements.referenceModal.classList.add('hidden');
  }

  prevReferencePage() {
    if (this.currentReferencePage > 1) {
      this.currentReferencePage--;
      this.renderReferencePage();
    }
  }

  nextReferencePage() {
    if (this.currentReferencePage < this.totalReferencePages) {
      this.currentReferencePage++;
      this.renderReferencePage();
    }
  }

  renderReferencePage() {
    this.elements.referencePageContent.innerHTML = this.getReferencePage(this.currentReferencePage);
    this.elements.pageIndicator.textContent = `Page ${this.currentReferencePage} of ${this.totalReferencePages}`;

    // Update button states
    this.elements.btnPrevPage.disabled = this.currentReferencePage === 1;
    this.elements.btnNextPage.disabled = this.currentReferencePage === this.totalReferencePages;
  }
}

// Start the game when page loads
window.addEventListener('DOMContentLoaded', () => {
  new GameClient();
});
