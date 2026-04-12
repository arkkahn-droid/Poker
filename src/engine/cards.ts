import type { Card, Deck } from '../types/cards'
import { RANKS, SUITS, SUIT_SYMBOLS, SUIT_COLORS } from '../types/cards'

// Card encoding: integer 0-51
// rank = card >> 2  (0=2, 1=3, ..., 12=Ace)
// suit = card & 3   (0=clubs, 1=diamonds, 2=hearts, 3=spades)

export function cardRank(card: Card): number {
  return card >> 2
}

export function cardSuit(card: Card): number {
  return card & 3
}

export function makeCard(rank: number, suit: number): Card {
  return (rank << 2) | suit
}

export function cardToString(card: Card): string {
  return RANKS[cardRank(card)] + SUITS[cardSuit(card)]
}

export function stringToCard(str: string): Card {
  const rankStr = str.length === 3 ? str.slice(0, 2) : str[0]
  const suitStr = str[str.length - 1] as typeof SUITS[number]
  const rank = RANKS.indexOf(rankStr as typeof RANKS[number])
  const suit = SUITS.indexOf(suitStr)
  if (rank === -1 || suit === -1) throw new Error(`Invalid card string: ${str}`)
  return makeCard(rank, suit)
}

export function cardRankSymbol(card: Card): string {
  const rank = cardRank(card)
  return rank === 8 ? '10' : RANKS[rank]
}

export function cardSuitSymbol(card: Card): string {
  return SUIT_SYMBOLS[cardSuit(card)]
}

export function cardSuitColor(card: Card): string {
  return SUIT_COLORS[cardSuit(card)]
}

export function createDeck(): Deck {
  const deck: Deck = []
  for (let i = 0; i < 52; i++) {
    deck.push(i)
  }
  return deck
}

// Fisher-Yates shuffle with optional seedable RNG
export function shuffle(deck: Deck, rng?: () => number): Deck {
  const d = [...deck]
  const rand = rng ?? Math.random
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

export function removeCards(deck: Deck, cards: Card[]): Deck {
  const cardSet = new Set(cards)
  return deck.filter((c) => !cardSet.has(c))
}

export function cardsToStrings(cards: Card[]): string[] {
  return cards.map(cardToString)
}

export function stringsToCards(strings: string[]): Card[] {
  return strings.map(stringToCard)
}

// Get display info for a card
export interface CardDisplay {
  rank: string
  suit: string
  color: string
  key: string
}

export function getCardDisplay(card: Card): CardDisplay {
  return {
    rank: cardRankSymbol(card),
    suit: cardSuitSymbol(card),
    color: cardSuitColor(card),
    key: cardToString(card),
  }
}
