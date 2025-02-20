import { Card } from '../types/game';
import { getCardValue, calculateHandScore } from './gameUtils';

// Evaluate how good a hand is for scoring
export const evaluateHand = (hand: Card[], cutCard?: Card): number => {
    return calculateHandScore(hand, cutCard);
};

// Choose the best cards to discard to crib
export const chooseBestDiscard = (hand: Card[], isDealer: boolean): number[] => {
    const discardIndices: number[] = [];
    let bestScore = -1;
    
    // Try all possible combinations of 2 cards to discard
    for (let i = 0; i < hand.length - 1; i++) {
        for (let j = i + 1; j < hand.length; j++) {
            const remainingHand = hand.filter((_, idx) => idx !== i && idx !== j);
            const discardHand = [hand[i], hand[j]];
            
            let score = evaluateHand(remainingHand);
            // If we're the dealer, consider the crib value positively
            if (isDealer) {
                score += evaluateHand(discardHand) * 0.5; // Weight crib cards less than hand cards
            } else {
                score -= evaluateHand(discardHand) * 0.5; // Opponent's crib is bad for us
            }
            
            if (score > bestScore) {
                bestScore = score;
                discardIndices[0] = i;
                discardIndices[1] = j;
            }
        }
    }
    
    return discardIndices;
};

// Choose the best card to play during the play phase
export const chooseBestPlay = (
    hand: Card[], 
    currentCount: number,
    playedCards: Card[]
): number => {
    const playableCards = hand.map((card, index) => ({
        index,
        card,
        playable: currentCount + getCardValue(card) <= 31
    })).filter(c => c.playable);
    
    if (playableCards.length === 0) return -1;
    
    let bestIndex = playableCards[0].index;
    let bestScore = -1;
    
    for (const {index, card} of playableCards) {
        let score = 0;
        const newCount = currentCount + getCardValue(card);
        
        // Points for hitting 15 or 31
        if (newCount === 15 || newCount === 31) score += 2;
        
        // Points for pairs/trips/quads with recently played cards
        const recentCards = [...playedCards.slice(-3), card];
        const pairCount = recentCards.filter(c => c.rank === card.rank).length - 1;
        score += pairCount * 2;
        
        // Prefer lower cards early (to leave room for plays)
        if (playedCards.length < 4) {
            score += (10 - getCardValue(card)) * 0.1;
        }
        
        if (score > bestScore) {
            bestScore = score;
            bestIndex = index;
        }
    }
    
    return bestIndex;
};