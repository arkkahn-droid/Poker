import { expose } from 'comlink'
import { calculateEquity } from '../engine/equity'
import type { EquityResult } from '../engine/equity'

const api = {
  calculateEquity(
    holeCards: number[][],
    board: number[],
    iterations: number = 10000,
  ): EquityResult {
    return calculateEquity(holeCards, board, iterations)
  },
}

expose(api)
