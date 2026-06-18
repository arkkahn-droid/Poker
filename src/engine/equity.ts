// Monte Carlo equity calculator
// Pure function — intended to run inside a Web Worker
import { evaluateCards } from 'phe'
import { cardToString, createDeck, removeCards, shuffle } from './cards'
import type { Card } from '../types/cards'

export interface EquityResult {
  equities: number[]   // one per player, 0-1 fraction
  iterations: number
  exact: boolean       // true if full enumeration was used
}

// Convert card array to phe strings
function toStrings(cards: Card[]): string[] {
  return cards.map(cardToString)
}

function evaluateStrings(strings: string[]): number {
  return evaluateCards(strings) as number
}

// Full enumeration when board is complete (river) or remaining deck is tiny
function exactEquity(
  holeCards: Card[][],
  board: Card[],
): EquityResult {
  const knownCards = [...board, ...holeCards.flat()]
  const remaining = removeCards(createDeck(), knownCards)

  const cardsNeeded = 5 - board.length

  // Generate all combinations of remaining cards for the board
  const combos: Card[][] = []
  buildCombinations(remaining, cardsNeeded, 0, [], combos)

  const wins = new Array<number>(holeCards.length).fill(0)
  let total = 0

  for (const combo of combos) {
    const fullBoard = [...board, ...combo]
    let bestRank = Infinity
    const winners: number[] = []

    for (let i = 0; i < holeCards.length; i++) {
      const rank = evaluateStrings(toStrings([...holeCards[i], ...fullBoard]))
      if (rank < bestRank) {
        bestRank = rank
        winners.length = 0
        winners.push(i)
      } else if (rank === bestRank) {
        winners.push(i)
      }
    }

    const share = 1 / winners.length
    for (const w of winners) wins[w] += share
    total++
  }

  return {
    equities: wins.map((w) => w / total),
    iterations: total,
    exact: true,
  }
}

function buildCombinations(
  arr: number[],
  k: number,
  start: number,
  current: number[],
  result: number[][],
): void {
  if (current.length === k) {
    result.push([...current])
    return
  }
  for (let i = start; i < arr.length; i++) {
    current.push(arr[i])
    buildCombinations(arr, k, i + 1, current, result)
    current.pop()
  }
}

// Monte Carlo simulation
function monteCarloEquity(
  holeCards: Card[][],
  board: Card[],
  iterations: number,
): EquityResult {
  const knownCards = [...board, ...holeCards.flat()]
  const remaining = removeCards(createDeck(), knownCards)
  const cardsNeeded = 5 - board.length

  const wins = new Array<number>(holeCards.length).fill(0)

  for (let iter = 0; iter < iterations; iter++) {
    const shuffled = shuffle(remaining)
    const simBoard = [...board, ...shuffled.slice(0, cardsNeeded)]

    let bestRank = Infinity
    const winners: number[] = []

    for (let i = 0; i < holeCards.length; i++) {
      const rank = evaluateStrings(toStrings([...holeCards[i], ...simBoard]))
      if (rank < bestRank) {
        bestRank = rank
        winners.length = 0
        winners.push(i)
      } else if (rank === bestRank) {
        winners.push(i)
      }
    }

    const share = 1 / winners.length
    for (const w of winners) wins[w] += share
  }

  return {
    equities: wins.map((w) => w / iterations),
    iterations,
    exact: false,
  }
}

export function calculateEquity(
  holeCards: Card[][],
  board: Card[],
  iterations = 10000,
): EquityResult {
  const cardsNeeded = 5 - board.length
  const knownCards = [...board, ...holeCards.flat()]
  const remaining = 52 - knownCards.length

  // Use exact enumeration when the search space is manageable
  // C(remaining, cardsNeeded): river=0 remaining cards needed → exact trivially
  // Turn: need 1 card, remaining ~44 → 44 combos → exact
  // Flop: need 2 cards, remaining ~45 → C(45,2)=990 → exact for 2 players
  // Preflop with 2+ players: too many combinations, use Monte Carlo
  const combosEstimate = combinations(remaining, cardsNeeded)

  if (combosEstimate <= 5000) {
    return exactEquity(holeCards, board)
  }

  return monteCarloEquity(holeCards, board, iterations)
}

function combinations(n: number, k: number): number {
  if (k > n) return 0
  if (k === 0 || k === n) return 1
  let result = 1
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1)
  }
  return result
}

// Range-based equity: only the player's cards are known; opponents get random hands each iteration.
// This is the correct way to calculate equity without inside information.
export function calculatePlayerEquity(
  playerCards: Card[],
  board: Card[],
  numOpponents: number,
  iterations = 8000,
): number {
  if (numOpponents === 0) return 1.0

  const knownCards = [...board, ...playerCards]
  const remaining = removeCards(createDeck(), knownCards)
  const cardsNeeded = 5 - board.length

  let wins = 0

  for (let iter = 0; iter < iterations; iter++) {
    const shuffled = shuffle(remaining)

    // Deal 2 random cards to each opponent
    const allHands: Card[][] = [playerCards]
    for (let i = 0; i < numOpponents; i++) {
      allHands.push([shuffled[i * 2], shuffled[i * 2 + 1]])
    }

    // Complete the board from cards after opponent hands
    const boardStart = numOpponents * 2
    const simBoard = [...board, ...shuffled.slice(boardStart, boardStart + cardsNeeded)]

    let bestRank = Infinity
    const winners: number[] = []

    for (let i = 0; i < allHands.length; i++) {
      const rank = evaluateStrings(toStrings([...allHands[i], ...simBoard]))
      if (rank < bestRank) {
        bestRank = rank
        winners.length = 0
        winners.push(i)
      } else if (rank === bestRank) {
        winners.push(i)
      }
    }

    if (winners.includes(0)) {
      wins += 1 / winners.length
    }
  }

  return wins / iterations
}
