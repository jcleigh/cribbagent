import { Card, Rank, Suit } from '../types/game';

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

export const createDeck = (): Card[] => {
    const deck: Card[] = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ suit, rank, faceUp: false });
        }
    }
    return deck;
};

export const shuffleDeck = (deck: Card[]): Card[] => {
    const newDeck = [...deck];
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
};

export const getCardValue = (card: Card): number => {
    if (['J', 'Q', 'K'].includes(card.rank)) return 10;
    if (card.rank === 'A') return 1;
    return parseInt(card.rank);
};

export const calculateFifteens = (cards: Card[]): number => {
    let count = 0;
    // Helper function to get combinations
    const getCombinations = (arr: Card[], size: number): Card[][] => {
        if (size === 1) return arr.map(card => [card]);
        const result: Card[][] = [];
        for (let i = 0; i <= arr.length - size; i++) {
            const combinations = getCombinations(arr.slice(i + 1), size - 1);
            combinations.forEach(combination => {
                result.push([arr[i], ...combination]);
            });
        }
        return result;
    };

    // Check all possible combinations for fifteens
    for (let i = 2; i <= cards.length; i++) {
        const combinations = getCombinations(cards, i);
        combinations.forEach(combination => {
            const sum = combination.reduce((acc, card) => acc + getCardValue(card), 0);
            if (sum === 15) count += 2;
        });
    }
    return count;
};

export const calculatePairs = (cards: Card[]): number => {
    let count = 0;
    for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
            if (cards[i].rank === cards[j].rank) count += 2;
        }
    }
    return count;
};

export const calculateRuns = (cards: Card[]): number => {
    let maxRun = 0;
    const sortedCards = [...cards].sort((a, b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank));
    
    for (let i = 0; i < sortedCards.length; i++) {
        let currentRun = 1;
        for (let j = i; j < sortedCards.length - 1; j++) {
            if (RANKS.indexOf(sortedCards[j + 1].rank) === RANKS.indexOf(sortedCards[j].rank) + 1) {
                currentRun++;
            } else {
                break;
            }
        }
        if (currentRun >= 3 && currentRun > maxRun) maxRun = currentRun;
    }
    return maxRun >= 3 ? maxRun : 0;
};

export const calculateHandScore = (hand: Card[], cutCard?: Card): number => {
    const cards = cutCard ? [...hand, cutCard] : [...hand];
    let score = 0;
    
    // Fifteens
    score += calculateFifteens(cards);
    
    // Pairs
    score += calculatePairs(cards);
    
    // Runs
    score += calculateRuns(cards);
    
    // Flush
    if (hand.every(card => card.suit === hand[0].suit)) {
        score += 4;
        if (cutCard && cutCard.suit === hand[0].suit) score += 1;
    }
    
    // His Nobs (Jack of the same suit as the cut card)
    if (cutCard && hand.some(card => card.rank === 'J' && card.suit === cutCard.suit)) {
        score += 1;
    }
    
    return score;
};