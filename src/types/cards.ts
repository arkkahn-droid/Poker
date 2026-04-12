// Card encoding: integer 0-51
// rank = card >> 2  (0=2, 1=3, ..., 12=Ace)
// suit = card & 3   (0=clubs, 1=diamonds, 2=hearts, 3=spades)

export type Card = number // 0-51

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const
export const SUITS = ['c', 'd', 'h', 's'] as const
export const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠'] as const
export const SUIT_COLORS = ['#1a1a2e', '#c0392b', '#c0392b', '#1a1a2e'] as const

export type Rank = (typeof RANKS)[number]
export type Suit = (typeof SUITS)[number]

export type Deck = Card[]
