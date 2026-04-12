// phe: lower rank number = better hand (1 = Royal Flush, 7462 = worst high card)
// handRank categories: 0=Straight Flush, 1=Four of a Kind, 2=Full House,
//   3=Flush, 4=Straight, 5=Three of a Kind, 6=Two Pair, 7=One Pair, 8=High Card
import { evaluateCards, handRank, rankDescription } from 'phe'
import { Hand } from 'pokersolver'
import { cardToString } from './cards'
import type { Card } from '../types/cards'

export type HandCategory =
  | 'straight-flush'
  | 'four-of-a-kind'
  | 'full-house'
  | 'flush'
  | 'straight'
  | 'three-of-a-kind'
  | 'two-pair'
  | 'one-pair'
  | 'high-card'

export interface HandResult {
  rank: number          // 1-7462, lower = better
  category: HandCategory
  categoryName: string  // "Straight Flush"
  description: string   // "Royal Flush" / "Full House, A's over K's"
  cards: Card[]         // the evaluated cards
}

const CATEGORY_MAP: HandCategory[] = [
  'straight-flush',
  'four-of-a-kind',
  'full-house',
  'flush',
  'straight',
  'three-of-a-kind',
  'two-pair',
  'one-pair',
  'high-card',
]

function categoryFromHandRank(hr: number): HandCategory {
  return CATEGORY_MAP[hr] ?? 'high-card'
}

export function evaluateHand(cards: Card[]): HandResult {
  const strings = cards.map(cardToString)
  const rank = evaluateCards(strings) as number
  const hr = handRank(rank) as number
  const category = categoryFromHandRank(hr)
  const categoryName = (rankDescription as string[])[hr] ?? 'High Card'

  // pokersolver gives us the natural language description
  let description = categoryName
  try {
    const solved = Hand.solve(strings)
    description = solved.descr ?? categoryName
  } catch {
    // fallback to category name if pokersolver fails
  }

  return { rank, category, categoryName, description, cards }
}

export function findBestHand(holeCards: Card[], board: Card[]): HandResult {
  return evaluateHand([...holeCards, ...board])
}

// Returns -1 if hand1 wins, 1 if hand2 wins, 0 if tie
export function compareHands(hand1: HandResult, hand2: HandResult): -1 | 0 | 1 {
  if (hand1.rank < hand2.rank) return -1
  if (hand1.rank > hand2.rank) return 1
  return 0
}

// Evaluate multiple players' hands and return sorted results (winner first)
export interface PlayerHandResult {
  playerId: string
  result: HandResult
}

export function findWinners(
  playerHands: { playerId: string; holeCards: Card[] }[],
  board: Card[],
): PlayerHandResult[] {
  const evaluated = playerHands.map(({ playerId, holeCards }) => ({
    playerId,
    result: findBestHand(holeCards, board),
  }))

  evaluated.sort((a, b) => a.result.rank - b.result.rank)
  return evaluated
}

// Get human-readable hand strength for display
export function handStrengthLabel(category: HandCategory): string {
  const labels: Record<HandCategory, string> = {
    'straight-flush': 'Straight Flush',
    'four-of-a-kind': 'Four of a Kind',
    'full-house': 'Full House',
    flush: 'Flush',
    straight: 'Straight',
    'three-of-a-kind': 'Three of a Kind',
    'two-pair': 'Two Pair',
    'one-pair': 'One Pair',
    'high-card': 'High Card',
  }
  return labels[category]
}

// Relative hand strength 0-1 (rough bucket, useful for coaching display)
export function relativeStrength(rank: number): number {
  return 1 - (rank - 1) / 7461
}
