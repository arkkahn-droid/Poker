import type { AIDecision, AIPlayer } from '../types/ai'
import type { GameState, PlayerState } from '../types/game'
import type { ArchetypeConfig } from '../types/ai'
import { cardRank, cardSuit } from '../engine/cards'
import { potOddsRequired } from '../engine/potOdds'
import { analyzeBoardTexture } from '../engine/boardTexture'
import { classifyHoleCards, isInRange, PREBUILT_RANGES, THREEBET_RANGES } from './rangeAssigner'
import { getTimingDelay, getBetSizing, gaussianRandom } from './tells'

export function makeDecision(
  aiPlayer: AIPlayer,
  state: GameState,
  equity: number, // 0-1 equity vs all opponents
): AIDecision {
  const archetype = aiPlayer.archetype
  const playerState = state.players.find((p) => p.id === aiPlayer.id)
  if (!playerState) return { action: 'fold', amount: 0, delayMs: 500 }

  const delay = getTimingDelay(archetype)

  if (state.street === 'preflop') {
    return makePreflopDecision(archetype, playerState, state, delay)
  } else {
    return makePostflopDecision(archetype, playerState, state, equity, delay)
  }
}

function makePreflopDecision(
  archetype: ArchetypeConfig,
  player: PlayerState,
  state: GameState,
  delayMs: number,
): AIDecision {
  const [card1, card2] = player.holeCards
  if (card1 === undefined || card2 === undefined) return { action: 'fold', amount: 0, delayMs }

  const rank1 = cardRank(card1)
  const rank2 = cardRank(card2)
  const suited = cardSuit(card1) === cardSuit(card2)
  const hand = classifyHoleCards(rank1, rank2, suited)

  // Positional multiplier on open range
  const posMultiplier = getPositionMultiplier(archetype, player.seatIndex, state.dealerSeat, state.players.length)

  // Effective VPIP with positional adjustment
  const effectiveVpip = Math.min(0.85, archetype.vpip * posMultiplier)
  const effectivePfr = Math.min(effectiveVpip * 0.9, archetype.pfr * posMultiplier)

  // Determine how many hands to play (by rank position in VPIP range)
  const range = PREBUILT_RANGES[archetype.id]
  const inRange = isInRange(hand, range)

  // Facing a raise?
  const facingRaise = state.currentBet > state.blindLevel * 2

  // Facing a 3-bet?
  const facing3bet = countRaisesThisStreet(state) >= 2

  if (!facingRaise) {
    // First in: open raise or fold
    if (!inRange && Math.random() > 0.05) {
      // 5% chance to steal regardless (especially maniacs)
      if (Math.random() > archetype.vpip) {
        return { action: 'fold', amount: 0, delayMs }
      }
    }

    if (inRange || Math.random() < effectiveVpip * 0.1) {
      // Open raise if PFR, otherwise limp (calling stations and nits limp sometimes)
      if (Math.random() < effectivePfr) {
        const raiseSize = getBetSizing(archetype, state.pot, 2.5) // 2.5x open
        return { action: 'raise', amount: raiseSize, delayMs }
      } else if (archetype.pfr < 0.15) {
        // Nits and calling stations limp sometimes
        return { action: 'call', amount: state.currentBet - player.bet, delayMs }
      } else {
        return { action: 'fold', amount: 0, delayMs }
      }
    }

    return { action: 'fold', amount: 0, delayMs }
  }

  // Facing a single raise
  if (!facing3bet) {
    // Should we 3-bet?
    const inThreeBetRange = isInRange(hand, THREEBET_RANGES[archetype.id])
    if (inThreeBetRange && Math.random() < archetype.threeBetFreq * 3) {
      const raiseAmount = state.currentBet * 3
      return { action: 'raise', amount: raiseAmount, delayMs }
    }

    // Should we call?
    const callOdds = potOddsRequired(state.currentBet - player.bet, state.pot)
    const estimatedEquity = handEquityEstimate(hand)

    if (estimatedEquity >= callOdds && inRange) {
      return { action: 'call', amount: state.currentBet - player.bet, delayMs }
    }

    // Calling station calls much wider
    if (archetype.id === 'callingstation' && Math.random() < 0.6) {
      return { action: 'call', amount: state.currentBet - player.bet, delayMs }
    }

    return { action: 'fold', amount: 0, delayMs }
  }

  // Facing a 3-bet
  const premiums = new Set(['AA', 'KK', 'QQ', 'AKs', 'AKo'])
  if (premiums.has(hand)) {
    if (Math.random() < 0.7) {
      return { action: 'raise', amount: state.currentBet * 3, delayMs }
    }
    return { action: 'call', amount: state.currentBet - player.bet, delayMs }
  }

  if (Math.random() > archetype.foldTo3bet) {
    return { action: 'call', amount: state.currentBet - player.bet, delayMs }
  }

  return { action: 'fold', amount: 0, delayMs }
}

function makePostflopDecision(
  archetype: ArchetypeConfig,
  player: PlayerState,
  state: GameState,
  equity: number,
  delayMs: number,
): AIDecision {
  const facingBet = state.currentBet > player.bet
  const pot = state.pot
  const texture = analyzeBoardTexture(state.communityCards)

  // All-in consideration for short stacks
  const stackToPot = player.stack / Math.max(pot, 1)
  if (stackToPot < 0.3 && equity > 0.5) {
    return { action: 'allin', amount: player.stack, delayMs }
  }

  if (facingBet) {
    // Facing a bet: call, raise, or fold
    const callAmount = Math.min(state.currentBet - player.bet, player.stack)
    const callOdds = potOddsRequired(callAmount, pot)

    // Value raise with strong hands
    if (equity > 0.70 && Math.random() < archetype.af * 0.15) {
      const raiseAmount = getBetSizing(archetype, pot, 2.5)
      return { action: 'raise', amount: raiseAmount, delayMs }
    }

    // Call if equity justifies it (with implied odds bonus for draws)
    const impliedBonus = equity < 0.4 ? 0.05 : 0
    if (equity + impliedBonus >= callOdds) {
      // Calling station almost always calls
      if (archetype.id === 'callingstation' || Math.random() > archetype.foldToCbet) {
        return { action: 'call', amount: callAmount, delayMs }
      }
    }

    // Bluff raise on good board textures
    if (equity < 0.35 && texture.wetness !== 'dry' && Math.random() < archetype.bluffFreq * 0.3) {
      const raiseAmount = getBetSizing(archetype, pot, 2.2)
      return { action: 'raise', amount: raiseAmount, delayMs }
    }

    return { action: 'fold', amount: 0, delayMs }
  } else {
    // Not facing a bet: bet, check-raise setup, or check
    // Value betting
    if (equity > 0.65) {
      if (Math.random() < archetype.cbet || Math.random() < archetype.af * 0.2) {
        const betAmount = getBetSizing(archetype, pot)
        return { action: 'bet', amount: betAmount, delayMs }
      }
    }

    // Semi-bluff with draws
    if (equity > 0.30 && equity <= 0.65 && texture.wetness !== 'dry') {
      if (Math.random() < archetype.cbet * 0.6) {
        const betAmount = getBetSizing(archetype, pot, 0.55)
        return { action: 'bet', amount: betAmount, delayMs }
      }
    }

    // Pure bluff
    if (equity < 0.30 && Math.random() < archetype.bluffFreq) {
      const betAmount = getBetSizing(archetype, pot, 0.65)
      return { action: 'bet', amount: betAmount, delayMs }
    }

    // Slow play strong hands occasionally
    if (equity > 0.85 && Math.random() < 0.25) {
      return { action: 'check', amount: 0, delayMs }
    }

    return { action: 'check', amount: 0, delayMs }
  }
}

// Rough preflop equity estimate by hand category (used when no board exists)
function handEquityEstimate(hand: string): number {
  if (hand === 'AA') return 0.85
  if (hand === 'KK') return 0.82
  if (hand === 'QQ') return 0.80
  if (hand === 'JJ') return 0.77
  if (hand === 'TT') return 0.74
  if (['99', '88'].includes(hand)) return 0.70
  if (['77', '66'].includes(hand)) return 0.65
  if (hand.endsWith('s') && hand[0] === 'A') return 0.62
  if (hand === 'AKo') return 0.65
  if (hand === 'AQo' || hand === 'AJo') return 0.60
  if (['55', '44', '33', '22'].includes(hand)) return 0.58
  if (hand.endsWith('s') && ['KQs', 'KJs', 'QJs', 'JTs'].includes(hand)) return 0.58
  return 0.45
}

function getPositionMultiplier(
  archetype: ArchetypeConfig,
  seatIndex: number,
  dealerSeat: number,
  playerCount: number,
): number {
  const relPos = ((seatIndex - dealerSeat) + playerCount) % playerCount
  if (relPos === 0) return archetype.btnMultiplier   // BTN
  if (relPos === 5) return archetype.coMultiplier     // CO
  if (relPos === 4) return archetype.hjMultiplier     // HJ
  return 1.0 // blinds/UTG: play tighter
}

function countRaisesThisStreet(state: GameState): number {
  return state.handHistory.filter(
    (a) => a.street === state.street && (a.action === 'raise' || a.action === 'bet'),
  ).length
}

// Weighted random between fold / call / raise based on weights
export function weightedRandom(weights: { fold: number; call: number; raise: number }): 'fold' | 'call' | 'raise' {
  const total = weights.fold + weights.call + weights.raise
  const r = Math.random() * total
  if (r < weights.fold) return 'fold'
  if (r < weights.fold + weights.call) return 'call'
  return 'raise'
}

// Used for quick equity estimate for AI (not shown to player)
export { gaussianRandom }
