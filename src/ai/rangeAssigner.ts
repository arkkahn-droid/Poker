// Starting hand range definitions for preflop decisions
// Hands represented as "AKs" (suited), "AKo" (offsuit), "AA" (pair)
// VPIP threshold determines which hands to play

// All 169 starting hands ranked by strength (approximate)
// Index 0 = strongest (AA), 168 = weakest (32o)
const HAND_STRENGTH_ORDER: string[] = [
  // Pairs (13)
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
  // Premium suited aces
  'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
  // Premium offsuit aces
  'AKo', 'AQo', 'AJo', 'ATo',
  // Broadway suited
  'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs',
  // Broadway offsuit
  'KQo', 'KJo', 'KTo', 'QJo', 'QTo', 'JTo',
  // Suited connectors
  'T9s', '98s', '87s', '76s', '65s', '54s', '43s', '32s',
  // Suited 1-gappers
  'J9s', 'T8s', '97s', '86s', '75s', '64s', '53s', '42s',
  // Suited 2-gappers
  'K9s', 'Q9s', 'J8s', 'T7s', '96s', '85s', '74s', '63s', '52s',
  // Medium offsuit
  'A9o', 'A8o', 'A7o', 'A6o', 'A5o', 'A4o', 'A3o', 'A2o',
  // Suited Kx
  'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s',
  // Suited Qx
  'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s', 'Q3s', 'Q2s',
  // Suited Jx
  'J7s', 'J6s', 'J5s', 'J4s', 'J3s', 'J2s',
  // Offsuit connectors (weaker)
  'T9o', '98o', '87o', '76o', '65o', '54o',
  // Remaining offsuit
  'K9o', 'K8o', 'K7o', 'Q9o', 'Q8o', 'J9o', 'J8o', 'T8o', 'T7o',
  '97o', '96o', '86o', '85o', '75o', '74o', '64o', '63o', '53o', '43o',
  // Junk
  'K6o', 'K5o', 'K4o', 'K3o', 'K2o', 'Q7o', 'Q6o', 'Q5o', 'Q4o', 'Q3o', 'Q2o',
  'J7o', 'J6o', 'J5o', 'J4o', 'J3o', 'J2o', 'T6o', 'T5o', 'T4o', 'T3o', 'T2o',
  '95o', '94o', '93o', '92o', '84o', '83o', '82o', '73o', '72o', '62o', '52o', '42o', '32o',
]

const TOTAL_HANDS = 169

// Build starting range from VPIP percentage
export function buildRange(vpip: number): Set<string> {
  const count = Math.round(vpip * TOTAL_HANDS)
  return new Set(HAND_STRENGTH_ORDER.slice(0, count))
}

// Identify a hole card pair as a canonical hand string
export function classifyHoleCards(card1Rank: number, card2Rank: number, suited: boolean): string {
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
  const high = Math.max(card1Rank, card2Rank)
  const low = Math.min(card1Rank, card2Rank)

  if (high === low) return RANKS[high] + RANKS[low] // pair

  const suffix = suited ? 's' : 'o'
  return RANKS[high] + RANKS[low] + suffix
}

// Check if hand is in range
export function isInRange(hand: string, range: Set<string>): boolean {
  return range.has(hand)
}

// Pre-built ranges for each archetype
export const PREBUILT_RANGES = {
  nit: buildRange(0.12),
  tag: buildRange(0.22),
  lag: buildRange(0.35),
  callingstation: buildRange(0.48),
  maniac: buildRange(0.65),
}

// 3-bet ranges (tighter than open range — polarized: premiums + some bluffs)
export const THREEBET_RANGES = {
  nit: new Set(['AA', 'KK', 'QQ', 'AKs', 'AKo']),
  tag: new Set(['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo', 'AQs', 'AJs', 'A5s', 'A4s']),
  lag: new Set(['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AKo', 'AQs', 'AQo', 'AJs', 'KQs', 'A5s', 'A4s', 'A3s', '76s', '65s']),
  callingstation: new Set(['AA', 'KK', 'QQ']),
  maniac: buildRange(0.25), // maniac 3-bets 25% of hands
}
