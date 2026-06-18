import type { GameState, ActionType } from '../types/game'
import type { Card } from '../types/cards'
import type { CoachTip, TipSeverity } from '../types/coaching'
import { potOddsSummary } from '../engine/potOdds'
import { analyzeBoardTexture } from '../engine/boardTexture'
import { findBestHand, relativeStrength } from '../engine/handEvaluator'
import { cardRank, cardSuit, cardRankSymbol, cardSuitSymbol } from '../engine/cards'
import { getPositionName } from '../engine/gameFlow'

let tipIdCounter = 0
function makeTip(partial: Omit<CoachTip, 'id'>): CoachTip {
  return { ...partial, id: `tip-${++tipIdCounter}` }
}

// Evaluate starting hand quality from 2 hole cards (no board needed)
// rank: 0=2, 1=3, ..., 8=T, 9=J, 10=Q, 11=K, 12=A
function preflopHandQuality(cards: Card[]): { quality: 'strong' | 'decent' | 'marginal' | 'weak'; label: string } {
  const [c1, c2] = cards
  const r1 = Math.max(cardRank(c1), cardRank(c2))
  const r2 = Math.min(cardRank(c1), cardRank(c2))
  const suited = cardSuit(c1) === cardSuit(c2)
  const gap = r1 - r2

  // Pocket pairs
  if (gap === 0) {
    if (r1 >= 8) return { quality: 'strong', label: 'high pocket pair' }   // TT+
    if (r1 >= 4) return { quality: 'decent', label: 'mid pocket pair' }    // 66-99
    return { quality: 'marginal', label: 'low pocket pair' }                // 22-55
  }

  // Ace-high hands
  if (r1 === 12) {
    if (r2 >= 9) return { quality: 'strong', label: suited ? 'suited Ace broadway' : 'Ace broadway' }   // AJ+
    if (suited) return { quality: 'decent', label: 'suited Ace' }
    if (r2 >= 6) return { quality: 'marginal', label: 'Ace with mid kicker' }
    return { quality: 'weak', label: 'Ace with weak kicker' }
  }

  // Both broadway (J, Q, K — excluding Ace handled above)
  if (r2 >= 9) return { quality: 'decent', label: suited ? 'suited broadway' : 'broadway' }

  // Suited connectors / one-gappers with some rank
  if (suited && gap <= 2 && r1 >= 5) return { quality: 'decent', label: 'suited connector' }

  // King with decent kicker
  if (r1 === 11 && r2 >= 6) return { quality: 'marginal', label: 'King with kicker' }

  // High-card with weak kicker
  if (r1 >= 9) return { quality: 'weak', label: 'high card, weak kicker' }

  return { quality: 'weak', label: 'low cards' }
}

// ── Draw analysis ────────────────────────────────────────────────────────────

interface DrawInfo { description: string; outs: number; pct: number }

function outsToPct(outs: number, cardsTocome: number): number {
  if (cardsTocome <= 0) return 0
  if (cardsTocome === 1) return Math.round(outs / 46 * 100)
  // 2 cards to come: 1 - (47-outs)/47 * (46-outs)/46
  return Math.round((1 - ((47 - outs) / 47) * ((46 - outs) / 46)) * 100)
}

function analyzeDraws(holeCards: Card[], board: Card[]): DrawInfo[] {
  const draws: DrawInfo[] = []
  const cardsTocome = board.length === 3 ? 2 : board.length === 4 ? 1 : 0
  if (cardsTocome === 0) return draws

  const all = [...holeCards, ...board]
  const holeRankSet = new Set(holeCards.map(cardRank))
  const allRankSet = new Set(all.map(cardRank))

  // 1. Flush draw: 4 cards of same suit, with at least 1 hole card contributing
  const suitCounts = [0, 0, 0, 0]
  for (const c of all) suitCounts[cardSuit(c)]++
  for (let s = 0; s < 4; s++) {
    if (suitCounts[s] === 4 && holeCards.some(c => cardSuit(c) === s)) {
      draws.push({ description: 'Flush draw', outs: 9, pct: outsToPct(9, cardsTocome) })
      break
    }
  }

  // 2. Straight draw: find the best draw across all 5-rank windows
  let bestStraight: DrawInfo | null = null
  for (let low = 0; low <= 8; low++) {
    const window = [low, low + 1, low + 2, low + 3, low + 4]
    const inWindow = window.filter(r => allRankSet.has(r))
    if (inWindow.length !== 4) continue
    if (!window.some(r => holeRankSet.has(r))) continue // hole cards must contribute

    const consecutive = inWindow[3] - inWindow[0] === 3
    if (consecutive && !allRankSet.has(low) && !allRankSet.has(low + 4)) {
      // True OESD: 4 consecutive, both ends missing
      bestStraight = { description: 'Straight draw (open-ended)', outs: 8, pct: outsToPct(8, cardsTocome) }
      break // can't do better
    } else if (!bestStraight || bestStraight.outs < 4) {
      bestStraight = { description: consecutive ? 'Straight draw (one-ended)' : 'Gutshot straight draw', outs: 4, pct: outsToPct(4, cardsTocome) }
    }
  }
  if (bestStraight) draws.push(bestStraight)

  // 3. Pair improvement: hole pair → trips (2 outs), or paired board card → trips (2 outs)
  const [h1, h2] = holeCards
  if (h1 !== undefined && h2 !== undefined) {
    const r1 = cardRank(h1), r2 = cardRank(h2)
    const boardRankSet = new Set(board.map(cardRank))
    if (r1 === r2) {
      draws.push({ description: 'Pocket pair → trips', outs: 2, pct: outsToPct(2, cardsTocome) })
    } else if (boardRankSet.has(r1) || boardRankSet.has(r2)) {
      draws.push({ description: 'Pair → trips', outs: 2, pct: outsToPct(2, cardsTocome) })
    }
  }

  return draws
}

// Read what opponents have been doing this hand from the action history (no card info).
function readOpponentBehavior(state: GameState): string {
  const aggressive = new Set(['bet', 'raise', 'allin'])
  const opponentHistory = state.handHistory.filter((a) => a.playerId !== 'human')
  if (opponentHistory.length === 0) return ''

  // Focus on whoever last showed aggression, else the most recent actor
  const lastBettor = [...opponentHistory].reverse().find((a) => aggressive.has(a.action))
  const mainId = lastBettor?.playerId ?? opponentHistory[opponentHistory.length - 1].playerId
  const name = state.players.find((p) => p.id === mainId)?.name ?? 'Your opponent'

  const acts = (street: string) =>
    state.handHistory.filter((a) => a.playerId === mainId && a.street === street).map((a) => a.action)

  const pfActs = acts('preflop')
  const flopActs = acts('flop')
  const turnActs = acts('turn')

  const isAgg = (a: string[]) => a.some((x) => aggressive.has(x))

  const pfAgg = isAgg(pfActs)
  const flopAgg = isAgg(flopActs)
  const turnAgg = isAgg(turnActs)
  const turnPlayed = turnActs.length > 0

  if (flopAgg && turnPlayed && !turnAgg) {
    return `${name} bet the flop but checked the turn — often a sign of a one-street bluff or a medium hand losing confidence.`
  }
  if (flopAgg && turnAgg) {
    return `${name} has been betting both the flop and turn — sustained aggression usually means a strong made hand or a committed bluff.`
  }
  if (pfAgg && flopActs.length > 0 && !flopAgg) {
    return `${name} raised preflop but went passive on the flop — they may have missed the board or are slowplaying.`
  }
  if (!flopAgg && turnPlayed && !turnAgg && state.street === 'river') {
    return `${name} has been passive throughout — they're likely on a weak-to-medium hand looking for a cheap showdown.`
  }
  if (flopAgg && !turnPlayed) {
    return `${name} bet the flop — could be a made hand, a draw, or a continuation bet.`
  }

  return ''
}

// Generate a single cohesive coaching tip for the current situation.
export function generateTips(
  state: GameState,
  playerLevel: number,
  playerEquity: number,
): CoachTip[] {
  const human = state.players[0]
  if (!human || human.holeCards.length < 2) return []
  if (human.folded) return []

  const position = getPositionName(0, state.dealerSeat, state.players.length)
  const callAmount = Math.min(state.currentBet - human.bet, human.stack)
  const isCheckOption = state.currentBet === 0 || callAmount === 0

  // ── Preflop: starting hand + position in one sentence ───────────────────
  if (state.communityCards.length === 0) {
    const { quality, label } = preflopHandQuality(human.holeCards)
    const inPosition = position === 'BTN' || position === 'CO'
    let msg: string
    let severity: TipSeverity

    if (quality === 'strong') {
      msg = `You have a ${label} from ${position}. ${inPosition ? 'In position with a premium hand — r' : 'R'}aise to build the pot.`
      severity = 'good'
    } else if (quality === 'decent') {
      msg = `You have a ${label} from ${position}. ${inPosition ? 'Late position makes this comfortably playable.' : 'Worth playing, but fold to a 3-bet.'}`
      severity = 'info'
    } else if (quality === 'marginal') {
      msg = `You have ${label} from ${position}. ${inPosition ? 'Can steal if it folds to you; otherwise fold to a raise.' : 'Lean toward folding — hard to play out of position.'}`
      severity = 'warning'
    } else {
      msg = `You have ${label} from ${position} — a weak hand. Fold and wait for a better spot.`
      severity = 'warning'
    }

    return [makeTip({ concept: 'hand-strength', severity, timing: 'pre-action', title: 'Starting Hand', message: msg, minLevel: 1 })]
  }

  // ── Postflop: single narrative tip ──────────────────────────────────────
  let handDesc = ''
  let handStrength = 0
  try {
    const result = findBestHand(human.holeCards, state.communityCards)
    handStrength = relativeStrength(result.rank)
    handDesc = result.description
  } catch {
    return []
  }

  const draws = state.communityCards.length < 5 ? analyzeDraws(human.holeCards, state.communityCards) : []
  const bestDraw = draws.reduce<{ description: string; outs: number; pct: number } | null>(
    (best, d) => (!best || d.outs > best.outs ? d : best),
    null,
  )
  const texture = state.communityCards.length >= 3 ? analyzeBoardTexture(state.communityCards) : null
  const equityPct = playerEquity > 0 ? Math.round(playerEquity * 100) : null
  const opponentRead = readOpponentBehavior(state)

  // Determine recommendation
  let recommendation: string
  if (!isCheckOption && callAmount > 0) {
    const oddsAvailable = equityPct !== null && playerLevel >= 3
    if (handStrength > 0.70) {
      recommendation = `Raise for value — you have a strong hand.`
    } else if (handStrength > 0.45 || (bestDraw && bestDraw.outs >= 8)) {
      if (oddsAvailable) {
        const summary = potOddsSummary(callAmount, state.pot, playerEquity)
        const reqPct = Math.round(summary.required * 100)
        recommendation = summary.shouldCall
          ? `Call — pot odds need ${reqPct}% equity and you have ~${equityPct}%.`
          : `Borderline — pot odds need ${reqPct}% equity and you have ~${equityPct}%. Lean toward calling with this hand.`
      } else {
        recommendation = bestDraw
          ? `Calling has merit — you have a ${bestDraw.description.toLowerCase()} (~${bestDraw.pct}% to complete).`
          : `Call — your hand is strong enough to continue.`
      }
    } else {
      if (oddsAvailable) {
        const reqPct = Math.round(potOddsSummary(callAmount, state.pot, playerEquity).required * 100)
        recommendation = `Fold — pot odds need ${reqPct}% equity and you have only ~${equityPct}%.`
      } else {
        recommendation = `Fold — your hand is too weak to continue against this aggression.`
      }
    }
  } else {
    const wetBoard = texture?.wetness === 'wet'
    if (handStrength > 0.70) {
      recommendation = `Bet for value${wetBoard ? ' and to charge draws' : ''} — you have a strong hand.`
    } else if (handStrength > 0.45) {
      recommendation = wetBoard
        ? `Consider betting to protect your hand on this draw-heavy board.`
        : `Check to control the pot, or bet small for thin value.`
    } else if (bestDraw) {
      recommendation = `Check — you're mainly drawing. See the next card for free if you can.`
    } else {
      recommendation = `Check — your hand is too weak to bet for value here.`
    }
  }

  const parts: string[] = []
  if (opponentRead) parts.push(opponentRead)
  parts.push(recommendation)

  const title = bestDraw && handStrength < 0.40 ? bestDraw.description : handDesc
  const severity: TipSeverity = handStrength > 0.60 ? 'good' : handStrength > 0.30 ? 'info' : 'warning'

  return [makeTip({
    concept: 'hand-strength',
    severity,
    timing: 'pre-action',
    title,
    message: parts.join(' '),
    minLevel: 1,
  })]
}

// Generate a post-action coaching tip (feedback after player acts)
export function generatePostActionTip(
  state: GameState,
  playerLevel: number,
  playerEquity: number,
  action: ActionType,
): CoachTip | null {
  const human = state.players[0]
  if (!human) return null

  const callWouldBe = Math.min(state.currentBet - human.bet, human.stack)

  // Did they make a bad call?
  if (action === 'call' && callWouldBe > 0 && playerLevel >= 3) {
    const summary = potOddsSummary(callWouldBe, state.pot, playerEquity)
    if (!summary.shouldCall && summary.edgePct < -10) {
      return makeTip({
        concept: 'pot-odds',
        severity: 'mistake',
        timing: 'post-action',
        title: 'That call was unprofitable',
        message: playerLevel <= 4
          ? `You needed ${Math.round(summary.required * 100)}% equity to call, but had about ${Math.round(playerEquity * 100)}%. Over time, calls like this lose money.`
          : `Pot odds required ${Math.round(summary.required * 100)}% equity. You had ~${Math.round(playerEquity * 100)}% (${Math.round(summary.edgePct)}% edge). This was a -EV call.`,
        xpDelta: -5,
        minLevel: 3,
      })
    }
  }

  // Did they fold a good hand?
  if (action === 'fold' && playerEquity > 0.55 && playerLevel >= 3) {
    return makeTip({
      concept: 'pot-odds',
      severity: 'warning',
      timing: 'post-action',
      title: 'You folded with strong equity',
      message: `You had ~${Math.round(playerEquity * 100)}% equity before folding. While sometimes correct, this might have been a profitable call.`,
      minLevel: 3,
    })
  }

  // Good fold
  if (action === 'fold' && playerEquity < 0.30 && playerLevel >= 3) {
    return makeTip({
      concept: 'pot-odds',
      severity: 'good',
      timing: 'post-action',
      title: 'Good fold',
      message: `With only ~${Math.round(playerEquity * 100)}% equity, folding saved you chips. Discipline in tough spots is what separates good players.`,
      xpDelta: 5,
      minLevel: 3,
    })
  }

  return null
}

// ── Post-hand review (called at showdown) ───────────────────────────────────

function formatCard(card: Card): string {
  return cardRankSymbol(card) + cardSuitSymbol(card)
}

function formatCards(cards: Card[]): string {
  return cards.map(formatCard).join(' ')
}

export function generateHandReview(
  state: GameState,
  playerLevel: number,
  aiPlayers: import('../types/ai').AIPlayer[],
): CoachTip[] {
  const tips: CoachTip[] = []
  if (!state.showdownResult) return tips

  const human = state.players[0]
  const board = state.communityCards
  const { winnerId, amount, hand } = state.showdownResult
  const humanWon = winnerId.includes('human')

  const winnerPlayer = state.players.find(p => p.id === winnerId[0])
  const winnerName = winnerPlayer ? (winnerPlayer.isHuman ? 'You' : winnerPlayer.name) : 'Unknown'

  // ── Tip 1: Result summary ────────────────────────────────────────────────
  {
    let msg = ''
    if (humanWon) {
      msg = `You won $${amount.toLocaleString()}${hand ? ` with ${hand}` : ''}.`
      if (winnerPlayer?.holeCards.length) msg += ` Your hole cards: ${formatCards(winnerPlayer.holeCards)}.`
    } else {
      msg = `${winnerName} won $${amount.toLocaleString()}${hand ? ` with ${hand}` : ''}.`
      if (winnerPlayer?.holeCards.length) msg += ` They held ${formatCards(winnerPlayer.holeCards)}.`
    }
    tips.push(makeTip({
      concept: 'hand-strength',
      severity: humanWon ? 'good' : 'info',
      timing: 'post-hand',
      title: humanWon ? 'You won!' : `${winnerName} wins`,
      message: msg,
      minLevel: 1,
    }))
  }

  // ── Tip 2: Your play analysis ────────────────────────────────────────────
  if (human && human.holeCards.length >= 2 && board.length >= 3) {
    try {
      const humanHand = findBestHand(human.holeCards, board)
      const humanCards = formatCards(human.holeCards)

      if (human.folded) {
        // Show what they would have made
        let msg = `You folded ${humanCards} — on this board that would have been ${humanHand.description}.`
        if (winnerPlayer && !winnerPlayer.isHuman && winnerPlayer.holeCards.length >= 2) {
          try {
            const winnerHand = findBestHand(winnerPlayer.holeCards, board)
            const humanStrength = relativeStrength(humanHand.rank)
            const winnerStrength = relativeStrength(winnerHand.rank)
            if (humanStrength > winnerStrength) {
              msg += ` You were actually ahead of ${winnerName}'s ${winnerHand.description} — consider staying in longer when you have equity.`
            } else {
              msg += ` ${winnerName} had ${winnerHand.description} — your fold was correct.`
            }
          } catch { /* ignore */ }
        }
        tips.push(makeTip({
          concept: 'hand-strength',
          severity: 'info',
          timing: 'post-hand',
          title: `What you folded: ${humanHand.description}`,
          message: msg,
          minLevel: 1,
        }))
      } else if (!humanWon && winnerPlayer && !winnerPlayer.isHuman && winnerPlayer.holeCards.length >= 2) {
        try {
          const winnerHand = findBestHand(winnerPlayer.holeCards, board)
          const msg = `Your ${humanHand.description} (${humanCards}) lost to ${winnerName}'s ${winnerHand.description} (${formatCards(winnerPlayer.holeCards)}).`
          tips.push(makeTip({
            concept: 'hand-strength',
            severity: 'info',
            timing: 'post-hand',
            title: 'Your hand vs theirs',
            message: msg,
            minLevel: 1,
          }))
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  // ── Tip 3: Bluff / value-bet reveal ─────────────────────────────────────
  // Find the most active non-human bettor/raiser who went to showdown (cards visible)
  if (board.length >= 3) {
    const aggressors = state.players.filter(p =>
      !p.isHuman &&
      !p.folded &&
      p.holeCards.length >= 2 &&
      state.handHistory.some(a => a.playerId === p.id && (a.action === 'bet' || a.action === 'raise'))
    )

    for (const aggressor of aggressors) {
      try {
        const theirHand = findBestHand(aggressor.holeCards, board)
        const strength = relativeStrength(theirHand.rank)
        const theirActions = state.handHistory.filter(
          a => a.playerId === aggressor.id && (a.action === 'bet' || a.action === 'raise')
        )
        if (theirActions.length === 0) continue

        const biggestAction = theirActions.reduce((max, a) => a.amount > max.amount ? a : max)
        const aiConfig = aiPlayers.find(p => p.id === aggressor.id)
        const archName = aiConfig?.archetype.name ?? 'this player'
        const cards = formatCards(aggressor.holeCards)

        if (strength < 0.35) {
          // Bluff detected
          let msg = `${aggressor.name} bet $${biggestAction.amount} on the ${biggestAction.street} holding ${cards} (${theirHand.description}) — that was a bluff.`
          if (aiConfig) {
            if (aiConfig.archetype.id === 'maniac' || aiConfig.archetype.id === 'lag') {
              msg += ` ${archName} players bluff frequently — don't automatically fold to their aggression. Call them down with medium-strength hands.`
            } else {
              msg += ` This is unusual for a ${archName}. They tend to be more honest with their bets — they got away with one here.`
            }
          }
          tips.push(makeTip({
            concept: 'meta-game',
            severity: 'warning',
            timing: 'post-hand',
            title: `${aggressor.name} was bluffing`,
            message: msg,
            minLevel: 1,
          }))
          break
        } else if (strength > 0.65) {
          // Value bet
          let msg = `${aggressor.name} bet $${biggestAction.amount} on the ${biggestAction.street} with ${cards} (${theirHand.description}) — they had a real hand.`
          if (aiConfig) {
            if (aiConfig.archetype.id === 'nit') {
              msg += ` Nits almost never bluff — when a Nit bets big, give them credit.`
            } else if (aiConfig.archetype.id === 'callingstation') {
              msg += ` Calling Stations rarely bet without a strong hand. Their bet was for value.`
            } else {
              msg += ` When ${archName} players bet this size with strong hands, consider what you'd need to continue profitably.`
            }
          }
          tips.push(makeTip({
            concept: 'meta-game',
            severity: 'info',
            timing: 'post-hand',
            title: `${aggressor.name} bet for value`,
            message: msg,
            minLevel: 1,
          }))
          break
        }
      } catch { /* ignore */ }
    }
  }

  return tips.filter(t => t.minLevel <= playerLevel)
}
