export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
    suit: Suit;
    rank: Rank;
    faceUp: boolean;
}

export interface Player {
    id: number;
    name: string;
    hand: Card[];
    score: number;
    isCurrent: boolean;
}

export interface GameState {
    deck: Card[];
    players: Player[];
    crib: Card[];
    cutCard?: Card;
    phase: 'dealing' | 'discarding' | 'playing' | 'counting' | 'gameOver';
    currentPlayer: number;
    playedCards: Card[];
    currentCount: number;
}