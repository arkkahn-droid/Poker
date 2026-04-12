// Pure math functions for pot odds, implied odds, and EV calculations

// Pot odds as a fraction (0-1): the fraction of (pot+call) you're calling
// e.g., pot=100, call=25 → 25/(100+25) = 0.2 → you need 20% equity to break even
export function potOddsRequired(callAmount: number, pot: number): number {
  if (callAmount <= 0) return 0
  return callAmount / (pot + callAmount)
}

// Express pot odds as ratio string e.g. "4:1" (you risk 1 to win 4)
export function potOddsRatio(callAmount: number, pot: number): string {
  if (callAmount <= 0) return '∞:1'
  const ratio = pot / callAmount
  return `${ratio.toFixed(1)}:1`
}

// Implied pot odds: includes expected future bets if you hit
export function impliedOddsRequired(
  callAmount: number,
  pot: number,
  expectedFutureBets: number,
): number {
  if (callAmount <= 0) return 0
  return callAmount / (pot + callAmount + expectedFutureBets)
}

// Expected value of a call
// equity: fraction 0-1
// potIfWin: chips you'd win (pot + call, minus rake if any)
// costToCall: chips you put in
export function expectedValue(equity: number, potIfWin: number, costToCall: number): number {
  return equity * potIfWin - (1 - equity) * costToCall
}

// Count outs (cards that improve hand to likely winner)
// Returns useful ranges for coaching
export interface OutsInfo {
  outs: number
  equity2Card: number // equity with 2 cards to come (rule of 4)
  equity1Card: number // equity with 1 card to come (rule of 2)
}

export function outsToEquity(outs: number, cardsTocome: 1 | 2): number {
  // Rule of 2 and 4 (approximation, accurate enough for coaching)
  if (cardsTocome === 2) return Math.min(1, outs * 0.04)
  return Math.min(1, outs * 0.02)
}

export function outsInfo(outs: number): OutsInfo {
  return {
    outs,
    equity2Card: outsToEquity(outs, 2),
    equity1Card: outsToEquity(outs, 1),
  }
}

// Common draw outs reference
export const COMMON_DRAWS = {
  gutshot: outsInfo(4),
  twoPairToFullHouse: outsInfo(4),
  openEndedStraightDraw: outsInfo(8),
  flushDraw: outsInfo(9),
  flushDrawPlusGutshot: outsInfo(12),
  flushDrawPlusOESD: outsInfo(15),
  overcards: outsInfo(6),
  setToFullHouseOrQuads: outsInfo(10),
} as const

// Bet sizing as fraction of pot
export function betAsFractionOfPot(betAmount: number, pot: number): number {
  if (pot === 0) return 0
  return betAmount / pot
}

// Calculate minimum defense frequency (MDF) against a bet
// Prevents opponent from profitably bluffing 100% of range
export function minimumDefenseFrequency(betAmount: number, pot: number): number {
  return pot / (pot + betAmount)
}

// Stack-to-pot ratio (SPR)
export function stackToPotRatio(effectiveStack: number, pot: number): number {
  if (pot === 0) return Infinity
  return effectiveStack / pot
}

// Human-readable pot odds summary for coaching
export function potOddsSummary(callAmount: number, pot: number, equity: number): {
  required: number
  actual: number
  ratio: string
  shouldCall: boolean
  edgePct: number
} {
  const required = potOddsRequired(callAmount, pot)
  return {
    required,
    actual: equity,
    ratio: potOddsRatio(callAmount, pot),
    shouldCall: equity >= required,
    edgePct: (equity - required) * 100,
  }
}
