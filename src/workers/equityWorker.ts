import { expose } from 'comlink'
import { calculateEquity, calculatePlayerEquity } from '../engine/equity'
import type { EquityResult } from '../engine/equity'

const api = {
  calculateEquity(
    holeCards: number[][],
    board: number[],
    iterations: number = 10000,
  ): EquityResult {
    return calculateEquity(holeCards, board, iterations)
  },

  calculatePlayerEquity(
    playerCards: number[],
    board: number[],
    numOpponents: number,
    iterations: number = 8000,
  ): number {
    return calculatePlayerEquity(playerCards, board, numOpponents, iterations)
  },
}

expose(api)
