import type { GameState, ActionType } from '../types/game'
import type { Card } from '../types/cards'
import type { CoachTip } from '../types/coaching'
import { isConceptUnlocked } from './levels'
import { potOddsSummary } from '../engine/potOdds'
import { analyzeBoardTexture } from '../engine/boardTexture'
import { findBestHand, relativeStrength } from '../engine/handEvaluator'
import { cardRank, cardSuit } from '../engine/cards'
import { getPositionName } from '../engine/gameFlow'
import { ARCHETYPES } from '../ai/archetypes'
import type { ArchetypeId } from '../types/ai'

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

// Generate coaching tips for the current game situation
export function generateTips(
  state: GameState,
  playerLevel: number,
  playerEquity: number,
): CoachTip[] {
  const tips: CoachTip[] = []
  const human = state.players[0]
  if (!human || human.holeCards.length < 2) return tips

  const position = getPositionName(0, state.dealerSeat, state.players.length)
  const callAmount = Math.min(state.currentBet - human.bet, human.stack)
  const isCheckOption = state.currentBet === 0 || callAmount === 0

  // ── Pot odds tip (level 3+) ──────────────────────────────────────────────
  if (
    !isCheckOption &&
    callAmount > 0 &&
    isConceptUnlocked('pot-odds', playerLevel) &&
    state.street !== 'preflop'
  ) {
    const summary = potOddsSummary(callAmount, state.pot, playerEquity)
    const equityPct = Math.round(playerEquity * 100)
    const requiredPct = Math.round(summary.required * 100)

    if (summary.shouldCall) {
      tips.push(makeTip({
        concept: 'pot-odds',
        severity: 'info',
        timing: 'pre-action',
        title: 'Pot Odds: Call is profitable',
        message: playerLevel <= 4
          ? `You need ${requiredPct}% equity to call. You have about ${equityPct}% — calling is the right play here.`
          : `Pot odds require ${requiredPct}% equity. Your equity is ~${equityPct}% (edge: +${Math.abs(Math.round(summary.edgePct))}%). Call is +EV.`,
        minLevel: 3,
      }))
    } else {
      tips.push(makeTip({
        concept: 'pot-odds',
        severity: 'warning',
        timing: 'pre-action',
        title: 'Pot Odds: Fold is likely correct',
        message: playerLevel <= 4
          ? `You need ${requiredPct}% equity to call, but you only have about ${equityPct}%. Folding saves your chips.`
          : `Pot odds require ${requiredPct}% equity. Your equity is ~${equityPct}% (edge: ${Math.round(summary.edgePct)}%). Folding is -EV call.`,
        minLevel: 3,
      }))
    }
  }

  // ── Preflop starting hand tip (all levels) ──────────────────────────────
  if (state.communityCards.length === 0) {
    const { quality, label } = preflopHandQuality(human.holeCards)
    const inPosition = position === 'BTN' || position === 'CO'
    let msg = ''

    if (quality === 'strong') {
      msg = `You have a ${label} — a premium hand. Raise to build the pot${inPosition ? ' and take control' : ''}.`
    } else if (quality === 'decent') {
      msg = `You have a ${label}. Worth playing${inPosition ? ', especially with your position advantage' : ' — but tighten up if there are re-raises'}.`
    } else if (quality === 'marginal') {
      msg = `You have a ${label}. It can be playable${inPosition ? ' from late position, but don\'t overcommit' : ' occasionally, but fold to big raises'}.`
    } else {
      msg = inPosition
        ? `You have ${label} — weak cards, but you have position. A steal raise might work if the table is passive, otherwise fold.`
        : `You have ${label} — a weak starting hand. Folding is usually right here, especially with more players still to act.`
    }

    const severity = quality === 'strong' ? 'good' : quality === 'decent' ? 'info' : 'warning'
    tips.push(makeTip({
      concept: 'hand-strength',
      severity,
      timing: 'pre-action',
      title: `Starting Hand: ${label.charAt(0).toUpperCase() + label.slice(1)}`,
      message: msg,
      minLevel: 1,
    }))
  }

  // ── Hand strength tip (all levels) ──────────────────────────────────────
  if (isConceptUnlocked('hand-strength', playerLevel) && state.communityCards.length > 0) {
    try {
      const result = findBestHand(human.holeCards, state.communityCards)
      const strength = relativeStrength(result.rank)

      if (playerLevel <= 2) {
        // Simple language for beginners
        let msg = ''
        if (strength > 0.80) msg = `You have ${result.description} — that's a very strong hand! Consider betting.`
        else if (strength > 0.55) msg = `You have ${result.description} — a solid hand.`
        else if (strength > 0.30) msg = `You have ${result.description}. It's a decent hand, but be careful on dangerous boards.`
        else msg = `You have ${result.description} — that's a weak hand. Think about folding if there's a big bet.`

        if (msg) {
          tips.push(makeTip({
            concept: 'hand-strength',
            severity: strength > 0.55 ? 'good' : strength > 0.30 ? 'info' : 'warning',
            timing: 'pre-action',
            title: `Your Hand: ${result.description}`,
            message: msg,
            minLevel: 1,
          }))
        }
      } else {
        // Shorter, more technical for higher levels
        tips.push(makeTip({
          concept: 'hand-strength',
          severity: strength > 0.60 ? 'good' : 'info',
          timing: 'pre-action',
          title: result.description,
          message: `Relative strength: ${Math.round(strength * 100)}th percentile. Equity vs active players: ~${Math.round(playerEquity * 100)}%.`,
          minLevel: 3,
        }))
      }
    } catch {
      // ignore hand eval errors
    }
  }

  // ── Position tip (level 2+) ──────────────────────────────────────────────
  if (isConceptUnlocked('position', playerLevel) && state.street === 'preflop') {
    const inPosition = position === 'BTN' || position === 'CO'
    if (playerLevel <= 4) {
      tips.push(makeTip({
        concept: 'position',
        severity: inPosition ? 'good' : 'info',
        timing: 'pre-action',
        title: `You are in ${position}`,
        message: inPosition
          ? `${position} is a great spot — you act last and can see what everyone else does.`
          : `${position} means you act before most players. Play tighter from early position.`,
        minLevel: 2,
      }))
    } else {
      tips.push(makeTip({
        concept: 'position',
        severity: inPosition ? 'good' : 'info',
        timing: 'pre-action',
        title: `Position: ${position}`,
        message: inPosition
          ? `You have position advantage. Widen your opening range and consider more 3-bets.`
          : `Out of position — tighten your range and avoid marginal calls that are harder to navigate postflop.`,
        minLevel: 2,
      }))
    }
  }

  // ── Board texture tip (level 5+) ─────────────────────────────────────────
  if (
    isConceptUnlocked('board-texture', playerLevel) &&
    state.communityCards.length >= 3
  ) {
    const texture = analyzeBoardTexture(state.communityCards)
    let msg = ''

    if (texture.wetness === 'wet') {
      msg = playerLevel <= 6
        ? `This is a wet board — lots of possible draws. If you have a strong made hand, bet to deny equity.`
        : `Wet board: flush/straight draws present. Your range construction matters here — bet strong hands, protect against draws.`
    } else if (texture.wetness === 'semi-wet') {
      msg = `This board has some draw potential. Moderate bets work well for both value and protection.`
    } else {
      msg = playerLevel <= 6
        ? `Dry board — few draws possible. Good spot to bluff or bet thin for value.`
        : `Dry, disconnected board. Your c-bets will have higher success rate. Consider betting with a wider range including air.`
    }

    if (texture.paired) {
      msg += playerLevel <= 6
        ? ` The board is paired — full houses are possible.`
        : ` Paired board changes hand strengths significantly — top pair is weaker, trips/boats more likely.`
    }

    tips.push(makeTip({
      concept: 'board-texture',
      severity: 'info',
      timing: 'pre-action',
      title: `Board: ${texture.wetness.charAt(0).toUpperCase() + texture.wetness.slice(1)}${texture.paired ? ', Paired' : ''}`,
      message: msg,
      minLevel: 5,
    }))
  }

  // ── Opponent archetype tip (level 6+) ────────────────────────────────────
  if (isConceptUnlocked('meta-game', playerLevel) && !isCheckOption && callAmount > 0) {
    const activeBettors = state.players.filter(
      (p) => !p.folded && p.id !== 'human' && p.lastAction?.action === 'bet',
    )

    for (const bettor of activeBettors.slice(0, 1)) {
      const aiIdx = parseInt(bettor.id.replace('ai-', ''))
      const archetypeId = (['tag', 'callingstation', 'lag', 'nit', 'maniac'] as ArchetypeId[])[aiIdx]
      const arch = archetypeId ? ARCHETYPES[archetypeId] : null

      if (arch) {
        let msg = ''
        if (arch.id === 'callingstation') {
          msg = `${bettor.name} rarely bets — when they do, they usually have a real hand. Their bluff frequency is only ${Math.round(arch.bluffFreq * 100)}%. Be cautious.`
        } else if (arch.id === 'maniac') {
          msg = `${bettor.name} bluffs ${Math.round(arch.bluffFreq * 100)}% of the time. Don't give them too much credit — call down with medium hands.`
        } else if (arch.id === 'lag') {
          msg = `${bettor.name} bets wide. They could be bluffing — evaluate pot odds carefully.`
        } else if (arch.id === 'nit') {
          msg = `${bettor.name} only bets strong hands. Their range here is very tight. Folding marginal hands is often correct.`
        } else {
          msg = `${bettor.name} is a solid player. Their bet is likely for value or as a semi-bluff.`
        }

        tips.push(makeTip({
          concept: 'meta-game',
          severity: 'info',
          timing: 'pre-action',
          title: `Opponent Read: ${bettor.name}`,
          message: msg,
          minLevel: 7,
        }))
      }
    }
  }

  // Filter tips to player's level
  return tips.filter((t) => t.minLevel <= playerLevel)
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
