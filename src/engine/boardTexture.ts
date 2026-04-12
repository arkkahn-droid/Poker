import type { Card } from '../types/cards'
import { cardRank, cardSuit } from './cards'

export type BoardWetness = 'dry' | 'semi-wet' | 'wet'
export type BoardPairing = 'unpaired' | 'paired' | 'two-paired' | 'tripled'

export interface BoardTexture {
  wetness: BoardWetness
  pairing: BoardPairing
  hasFlushDraw: boolean    // 2+ same suit on board
  hasFlushComplete: boolean // 3+ same suit (flush possible)
  hasStraightDraw: boolean  // 3+ connected/gapped cards
  hasStraightComplete: boolean // straight on board possible
  highCard: number          // rank 0-12 of highest board card
  lowCard: number           // rank of lowest board card
  spread: number            // highCard - lowCard
  isRainbow: boolean        // all different suits
  isTwoTone: boolean        // exactly 2 suits
  isMonotone: boolean       // all same suit
  paired: boolean           // shortcut for pairing !== 'unpaired'
  suitCounts: number[]      // count per suit [clubs, diamonds, hearts, spades]
  rankCounts: number[]      // count per rank (0-12)
}

export function analyzeBoardTexture(board: Card[]): BoardTexture {
  const ranks = board.map(cardRank)
  const suits = board.map(cardSuit)

  // Suit counts
  const suitCounts = [0, 0, 0, 0]
  for (const s of suits) suitCounts[s]++

  const maxSuitCount = Math.max(...suitCounts)
  const distinctSuits = suitCounts.filter((c) => c > 0).length

  // Rank counts for pairing
  const rankCounts = new Array<number>(13).fill(0)
  for (const r of ranks) rankCounts[r]++

  const pairs = rankCounts.filter((c) => c >= 2).length
  const tripled = rankCounts.some((c) => c >= 3)

  let pairing: BoardPairing = 'unpaired'
  if (tripled) pairing = 'tripled'
  else if (pairs >= 2) pairing = 'two-paired'
  else if (pairs === 1) pairing = 'paired'

  // Straight texture: look for consecutive or near-consecutive ranks
  const sortedRanks = [...new Set(ranks)].sort((a, b) => a - b)
  const spread = sortedRanks.length > 1
    ? sortedRanks[sortedRanks.length - 1] - sortedRanks[0]
    : 0

  // Check for straight draw potential: any 3 cards within a 4-card window
  let hasStraightDraw = false
  let hasStraightComplete = false

  if (board.length >= 3) {
    // Check all windows of 5 consecutive ranks
    for (let low = 0; low <= 8; low++) {
      let count = 0
      for (const r of sortedRanks) {
        if (r >= low && r <= low + 4) count++
      }
      if (count >= 3) hasStraightDraw = true
      if (count >= 4) hasStraightComplete = true // straight draw with 1 out or complete
    }
    // Also check wheel (A-2-3-4-5): Ace can be low (rank 12 as rank -1)
    const hasAce = sortedRanks.includes(12)
    if (hasAce) {
      for (let low = 0; low <= 3; low++) {
        let count = 1 // Ace counts
        for (const r of sortedRanks) {
          if (r >= low && r <= low + 3) count++
        }
        if (count >= 3) hasStraightDraw = true
      }
    }
  }

  const hasFlushDraw = maxSuitCount >= 2
  const hasFlushComplete = maxSuitCount >= 3

  const isMonotone = distinctSuits === 1
  const isTwoTone = distinctSuits === 2
  const isRainbow = distinctSuits >= 3 && !isMonotone

  // Wetness score
  let wetnessScore = 0
  if (hasFlushDraw) wetnessScore += 1
  if (hasFlushComplete) wetnessScore += 1
  if (hasStraightDraw) wetnessScore += 1
  if (hasStraightComplete) wetnessScore += 1
  if (spread <= 4) wetnessScore += 1 // connected board

  let wetness: BoardWetness
  if (wetnessScore >= 3) wetness = 'wet'
  else if (wetnessScore >= 1) wetness = 'semi-wet'
  else wetness = 'dry'

  const highCard = ranks.length > 0 ? Math.max(...ranks) : 0
  const lowCard = ranks.length > 0 ? Math.min(...ranks) : 0

  return {
    wetness,
    pairing,
    hasFlushDraw,
    hasFlushComplete,
    hasStraightDraw,
    hasStraightComplete,
    highCard,
    lowCard,
    spread,
    isRainbow,
    isTwoTone,
    isMonotone,
    paired: pairing !== 'unpaired',
    suitCounts,
    rankCounts,
  }
}

export function boardTextureLabel(texture: BoardTexture): string {
  const parts: string[] = []
  if (texture.isMonotone) parts.push('monotone')
  else if (texture.isTwoTone) parts.push('two-tone')
  else parts.push('rainbow')

  if (texture.pairing === 'tripled') parts.push('tripped')
  else if (texture.pairing === 'two-paired') parts.push('double-paired')
  else if (texture.pairing === 'paired') parts.push('paired')

  if (texture.wetness === 'wet') parts.push('wet')
  else if (texture.wetness === 'semi-wet') parts.push('semi-wet')
  else parts.push('dry')

  return parts.join(', ')
}
