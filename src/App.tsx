import { useState, useEffect, useCallback } from 'react';
import { GameState } from './types/game';
import { createDeck, shuffleDeck, getCardValue, calculateHandScore } from './utils/gameUtils';
import { chooseBestDiscard, chooseBestPlay } from './utils/aiUtils';
import './App.css';

const MAX_SCORE = 121; // Traditional cribbage winning score

const phaseInstructions = {
  dealing: {
    title: "Dealing Phase",
    instructions: "Each player is dealt 6 cards. Wait for the dealing to complete."
  },
  discarding: {
    title: "Discarding to Crib",
    instructions: "Each player must discard 2 cards to the crib (4 total). Click on cards to discard them. The crib belongs to the dealer and will be counted as extra points."
  },
  playing: {
    title: "Playing Phase (The Play)",
    instructions: "Players take turns playing cards. Try to make combinations:\n• Pairs (2 pts)\n• Three of a kind (6 pts)\n• Four of a kind (12 pts)\n• Runs of 3+ (1 pt per card)\n• Total count of 15 (2 pts)\n• Total count of 31 (2 pts)\n\nIf you can't play a card that keeps the count at 31 or below, you must say 'Go'.\nWhen you say 'Go', your opponent gets 1 point and the count resets to 0."
  },
  counting: {
    title: "Counting Phase (The Show)",
    instructions: "Points are counted in this order:\n1. Non-dealer's hand\n2. Dealer's hand\n3. Dealer's crib\n\nScoring combinations:\n• Fifteens (2 pts each)\n• Pairs (2 pts)\n• Runs (1 pt per card)\n• Flushes (4+ pts)\n• Nobs - Jack of same suit as starter (1 pt)"
  },
  gameOver: {
    title: "Game Over",
    instructions: "First player to reach 121 points wins! Click 'Play Again' to start a new game."
  }
};

function App() {
  const [showNamePrompt, setShowNamePrompt] = useState(true);
  const [playerName, setPlayerName] = useState('Player 1');
  const [gameState, setGameState] = useState<GameState>({
    deck: [],
    players: [
      { id: 0, name: playerName, hand: [], score: 0, isCurrent: true },
      { id: 1, name: 'Computer', hand: [], score: 0, isCurrent: false }
    ],
    crib: [],
    phase: 'dealing',
    currentPlayer: 0,
    playedCards: [],
    currentCount: 0
  });
  
  // Add state to track pending discards
  const [pendingDiscards, setPendingDiscards] = useState<Set<string>>(new Set());

  const startNewGame = useCallback(() => {
    const shuffledDeck = shuffleDeck(createDeck());
    const player1Hand = shuffledDeck.slice(0, 6);
    const player2Hand = shuffledDeck.slice(6, 12);
    const remainingDeck = shuffledDeck.slice(12);

    setGameState(prev => ({
      ...prev,
      deck: remainingDeck,
      players: [
        { ...prev.players[0], hand: player1Hand, name: playerName },
        { ...prev.players[1], hand: player2Hand }
      ],
      crib: [],
      cutCard: remainingDeck[0], // Add cut card
      phase: 'discarding' as const,
      playedCards: [],
      currentCount: 0,
      currentPlayer: 0
    }));
  }, [playerName]);

  const getPlayerDiscardCount = (playerId: number): number => {
    return gameState.crib.filter((_, i) => i % 2 === playerId).length;
  };

  const discardToCrib = (playerId: number, cardIndex: number) => {
    const discardKey = `${playerId}-${cardIndex}`;
    if (pendingDiscards.has(discardKey)) return;

    // Add to pending discards immediately
    setPendingDiscards(prev => new Set(prev).add(discardKey));

    // Rest of discard logic
    if (playerId !== gameState.currentPlayer) return;
    
    const playerDiscardCount = gameState.crib.filter((_, i) => i % 2 === playerId).length;
    if (playerDiscardCount >= 2) return;

    const playerHand = [...gameState.players[playerId].hand];
    const discardedCard = playerHand.splice(cardIndex, 1)[0];
    const newCrib = [...gameState.crib, discardedCard];
    const isDiscardingComplete = newCrib.length === 4;

    setGameState(prev => {
      const newState = {
        ...prev,
        players: prev.players.map((player, idx) =>
          idx === playerId ? { ...player, hand: playerHand } : player
        ),
        crib: newCrib,
        phase: isDiscardingComplete ? 'playing' as const : 'discarding' as const,
        currentPlayer: isDiscardingComplete ? 0 : 
          (getPlayerDiscardCount((playerId + 1) % 2) < 2 ? (playerId + 1) % 2 : playerId)
      };

      // Clear pending discards after state update
      setPendingDiscards(new Set());
      
      return newState;
    });
  };

  const updateScore = (playerId: number, points: number) => {
    setGameState(prev => {
      const newScore = prev.players[playerId].score + points;
      const updatedPlayers = prev.players.map((player, idx) => 
        idx === playerId 
          ? { ...player, score: Math.min(newScore, MAX_SCORE) }
          : player
      );

      // Check for winner
      if (newScore >= MAX_SCORE) {
        return {
          ...prev,
          players: updatedPlayers,
          phase: 'gameOver'
        };
      }

      return {
        ...prev,
        players: updatedPlayers
      };
    });
  };

  const handleHandScoring = (playerId: number) => {
    const score = calculateHandScore(gameState.players[playerId].hand, gameState.cutCard);
    updateScore(playerId, score);
    
    // After non-dealer counts, dealer counts
    // After dealer counts, dealer counts crib
    setGameState(prev => {
      if (playerId === 0) { // non-dealer counted
        return { ...prev, currentPlayer: 1 };
      } else { // dealer counted
        const cribScore = calculateHandScore([...prev.crib], prev.cutCard);
        updateScore(1, cribScore); // dealer gets crib points
        return { ...prev, phase: 'dealing' as const, currentPlayer: 0 };
      }
    });
  };

  const playCard = (playerId: number, cardIndex: number) => {
    // First gather all the information we need
    const playerHand = [...gameState.players[playerId].hand];
    const playedCard = playerHand[cardIndex];  // Don't splice yet, just reference
    const newCount = gameState.currentCount + getCardValue(playedCard);
    
    if (newCount > 31) return;

    // Calculate pegging points before any state updates
    let peggingPoints = 0;
    const newPlayedCards = [...gameState.playedCards, playedCard];
    
    if (newCount === 15) peggingPoints += 2;
    if (newCount === 31) peggingPoints += 2;

    // Calculate pairs (last 4 cards)
    const recentCards = newPlayedCards.slice(-4);
    const lastRank = playedCard.rank;
    const pairCount = recentCards.filter(c => c.rank === lastRank).length - 1;
    if (pairCount > 0) peggingPoints += pairCount * 2;

    // Now remove the card from hand
    playerHand.splice(cardIndex, 1);

    // Check if this will be the last card played
    const allCardsPlayed = playerHand.length === 0 && 
      gameState.players.every((p, idx) => 
        idx === playerId ? true : p.hand.length === 0
      );

    // First update the game state
    setGameState(prev => ({
      ...prev,
      players: prev.players.map((player, idx) =>
        idx === playerId ? { ...player, hand: playerHand } : player
      ),
      playedCards: newPlayedCards,
      currentCount: newCount,
      currentPlayer: (playerId + 1) % 2,
      phase: allCardsPlayed ? 'counting' : prev.phase
    }));

    // Then update the score if there are pegging points
    if (peggingPoints > 0) {
      updateScore(playerId, peggingPoints);
    }
  };

  const canPlayAnyCard = (playerId: number): boolean => {
    const playerHand = gameState.players[playerId].hand;
    return playerHand.some(card => 
      (gameState.currentCount + getCardValue(card)) <= 31
    );
  };

  const handleGo = () => {
    const currentPlayer = gameState.currentPlayer;
    const otherPlayer = (currentPlayer + 1) % 2;
    
    // Award 1 point to the other player for the "go"
    updateScore(otherPlayer, 1);

    // Check if other player can make a play
    const otherPlayerCanPlay = canPlayAnyCard(otherPlayer);

    // Reset the count and continue play or move to next phase
    setGameState(prev => ({
      ...prev,
      currentCount: otherPlayerCanPlay ? prev.currentCount : 0,
      playedCards: [...prev.playedCards],
      currentPlayer: otherPlayerCanPlay ? otherPlayer : currentPlayer,
      // If neither player can play, move to counting phase
      phase: (!otherPlayerCanPlay && !canPlayAnyCard(currentPlayer)) ? 'counting' as const : 'playing' as const
    }));
  };

  useEffect(() => {
    if (!showNamePrompt) {
      startNewGame();
    }
  }, [showNamePrompt, startNewGame]); // Add missing dependencies

  // Add AI move effect
  useEffect(() => {
    if (gameState.phase === 'counting' || gameState.currentPlayer === 1) { // Handle counting phase and Computer's turn
      const makeAIMove = setTimeout(() => {
        if (gameState.phase === 'discarding') {
          // Choose and discard two cards
          const discardIndices = chooseBestDiscard(
            gameState.players[1].hand,
            gameState.crib.length === 0 // is dealer
          );
          // Discard in reverse order to maintain correct indices
          discardToCrib(1, discardIndices[1]);
          discardToCrib(1, discardIndices[0]);
        } else if (gameState.phase === 'playing') {
          const bestPlayIndex = chooseBestPlay(
            gameState.players[1].hand,
            gameState.currentCount,
            gameState.playedCards
          );
          
          if (bestPlayIndex === -1) {
            handleGo();
          } else {
            playCard(1, bestPlayIndex);
          }
        } else if (gameState.phase === 'counting') {
          // Automatically handle counting for both players
          handleHandScoring(gameState.currentPlayer);
        }
      }, 1000); // 1 second delay to make moves visible

      return () => clearTimeout(makeAIMove);
    }
  }, [
    gameState.currentPlayer,
    gameState.phase,
    gameState.players,
    gameState.currentCount,
    gameState.crib.length,
    gameState.playedCards,
    discardToCrib,
    handleGo,
    handleHandScoring,
    playCard
  ]);

  // Add handler for name submission
  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      setShowNamePrompt(false);
      startNewGame();
    }
  };

  // Update the card rendering to check pendingDiscards
  const isCardDisabled = (playerId: number, cardIndex: number) => {
    return pendingDiscards.has(`${playerId}-${cardIndex}`) ||
           gameState.currentPlayer !== playerId ||
           (gameState.phase === 'discarding' && getPlayerDiscardCount(playerId) >= 2);
  };

  return (
    <div className="game-container">
      {showNamePrompt ? (
        <div className="name-prompt-overlay">
          <div className="name-prompt-dialog">
            <button 
              type="button"
              tabIndex={-1}
              className="name-prompt-close" 
              onClick={() => {
                setPlayerName('Player 1');
                setShowNamePrompt(false);
              }}
            >
              ×
            </button>
            <h2>Welcome to Cribbage!</h2>
            <form onSubmit={handleNameSubmit}>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value.slice(0, 15))}
                placeholder="Enter your name (max 15 chars)"
                maxLength={15}
                required
                autoFocus
              />
              <button type="submit">Start Game</button>
            </form>
          </div>
        </div>
      ) : (
        <>
          <div className="help-panel">
            <h2>Cribbage Guide</h2>
            <div className="phase-info">
              <h3>{phaseInstructions[gameState.phase].title}</h3>
              <p>{phaseInstructions[gameState.phase].instructions}</p>
            </div>
            <div className="general-rules">
              <h3>Quick Rules</h3>
              <ul>
                <li>First to 121 points wins</li>
                <li>Each hand has 4 cards after discarding</li>
                <li>Counting combinations:</li>
                <li>• 15s = 2 points</li>
                <li>• Pairs = 2 points</li>
                <li>• Runs = 1 point per card</li>
                <li>• Flush = 4+ points</li>
                <li>• His Nobs = 1 point</li>
              </ul>
            </div>
            <div className="scoring-board">
              {gameState.players.map((player) => (
                <div key={player.id} className={`player-score-track player${player.id + 1}`}>
                  <div className="score-label">
                    <span>{player.name}</span>
                    <span>{player.score} / {MAX_SCORE}</span>
                  </div>
                  <div className="score-track">
                    <div 
                      className="score-fill" 
                      style={{ width: `${(player.score / MAX_SCORE) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="main-game-area">
            <div className="player-area player2">
              <h2>{gameState.players[1].name}</h2>
              <div className={`hand ${gameState.currentPlayer === 1 ? 'current-player' : ''}`}>
                {gameState.players[1].hand.map((_, index) => (
                  <div 
                    key={index} 
                    className={`card back ${
                      isCardDisabled(1, index) ? 'disabled' : ''
                    }`}
                  >
                    <div className="card-back-pattern">♠♣♥♦</div>
                  </div>
                ))}
              </div>
              {gameState.phase === 'discarding' && (
                <div className={`discard-status ${getPlayerDiscardCount(1) === 2 ? 'complete' : ''}`}>
                  Cards discarded: {getPlayerDiscardCount(1)} / 2
                </div>
              )}
              <div className="score">Score: {gameState.players[1].score}</div>
            </div>

            <div className="game-board">
              {gameState.phase === 'playing' && (
                <div className="player-turn-indicator">
                  {gameState.players[gameState.currentPlayer].name}'s turn
                  {!canPlayAnyCard(gameState.currentPlayer) && " (Must say 'Go')"}
                </div>
              )}
              
              {gameState.phase === 'discarding' && (
                <div className="player-turn-indicator">
                  {gameState.players[gameState.currentPlayer].name}'s turn to discard
                </div>
              )}

              {gameState.phase === 'counting' && (
                <div className="player-turn-indicator">
                  Counting hands...
                </div>
              )}
              
              {gameState.cutCard && (
                <div className="cut-card">
                  <h3>Cut Card</h3>
                  <div className={`card ${gameState.cutCard.suit}`}>
                    <div className="card-value">{gameState.cutCard.rank}</div>
                    <div className="card-suit">
                      {gameState.cutCard.suit === 'hearts' && '♥'}
                      {gameState.cutCard.suit === 'diamonds' && '♦'}
                      {gameState.cutCard.suit === 'clubs' && '♣'}
                      {gameState.cutCard.suit === 'spades' && '♠'}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="crib">
                {gameState.crib.map((_, index) => (
                  <div key={index} className="card back">
                    <div className="card-back-pattern">♠♣♥♦</div>
                  </div>
                ))}
              </div>

              {gameState.phase === 'dealing' && (
                <div className="dealing-phase">
                  <button 
                    className="deal-button"
                    onClick={startNewGame}
                  >
                    Deal Next Hand
                  </button>
                </div>
              )}

              {gameState.phase === 'playing' && (
                <>
                  <div className="played-cards">
                    {gameState.playedCards.map((card, index) => (
                      <div key={index} className={`card ${card.suit}`}>
                        <div className="card-value">{card.rank}</div>
                        <div className="card-suit">
                          {card.suit === 'hearts' && '♥'}
                          {card.suit === 'diamonds' && '♦'}
                          {card.suit === 'clubs' && '♣'}
                          {card.suit === 'spades' && '♠'}
                        </div>
                      </div>
                    ))}
                  </div>
                  {!canPlayAnyCard(gameState.currentPlayer) && (
                    <button 
                      className="go-button"
                      onClick={handleGo}
                    >
                      Say "Go"
                    </button>
                  )}
                </>
              )}

              {gameState.phase === 'playing' && (
                <div className="count">Count: {gameState.currentCount}</div>
              )}
            </div>

            <div className="player-area player1">
              <h2>{gameState.players[0].name}</h2>
              <div className={`hand ${gameState.currentPlayer === 0 ? 'current-player' : ''}`}>
                {gameState.players[0].hand.map((card, index) => (
                  <div 
                    key={index} 
                    className={`card ${card.suit} ${
                      isCardDisabled(0, index) ? 'disabled' : ''
                    } ${
                      gameState.phase === 'playing' && 
                      (gameState.currentCount + getCardValue(card)) > 31 ? 'unplayable' : ''
                    }`}
                    onClick={() => {
                      if (!isCardDisabled(0, index)) {
                        if (gameState.phase === 'discarding') {
                          discardToCrib(0, index);
                        } else if (gameState.phase === 'playing' && 
                                   (gameState.currentCount + getCardValue(card)) <= 31) {
                          playCard(0, index);
                        }
                      }
                    }}
                  >
                    <div className="card-value">{card.rank}</div>
                    <div className="card-suit">
                      {card.suit === 'hearts' && '♥'}
                      {card.suit === 'diamonds' && '♦'}
                      {card.suit === 'clubs' && '♣'}
                      {card.suit === 'spades' && '♠'}
                    </div>
                  </div>
                ))}
              </div>
              {gameState.phase === 'discarding' && (
                <div className={`discard-status ${getPlayerDiscardCount(0) === 2 ? 'complete' : ''}`}>
                  Cards discarded: {getPlayerDiscardCount(0)} / 2
                </div>
              )}
              <div className="score">Score: {gameState.players[0].score}</div>
            </div>

            {gameState.phase === 'gameOver' && (
              <div className="winning-message">
                <h1>🎉 Winner! 🎉</h1>
                <p>{gameState.players.find(p => p.score >= MAX_SCORE)?.name} has won!</p>
                <button onClick={startNewGame}>Play Again</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
