import type { GameState, ActionType } from '../types/game'
import type { Card } from '../types/cards'
import type { CoachTip } from '../types/coaching'
import { isConceptUnlocked } from './levels'
import { potOddsSummary } from '../engine/potOdds'
import { analyzeBoardTexture } from '../engine/boardTexture'
import { findBestHand, relativeStrength } from '../engine/handEvaluator'
import { cardRank, cardSuit, cardRankSymbol, cardSuitSymbol } from '../engine/cards'
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

// Generate coaching tips for the current game situation
export function generateTips(
  state: GameState,
  playerLevel: number,
  playerEquity: number,
): CoachTip[] {
  const tips: CoachTip[] = []
  const human = state.players[0]
  if (!human || human.holeCards.length < 2) return tips
  if (human.folded) return tips  // no tips once the human has folded

  const position = getPositionName(0, state.dealerSeat, state.players.length)
  const callAmount = Math.min(state.currentBet - human.bet, human.stack)
  const isCheckOption = state.currentBet === 0 || callAmount === 0

  // ── Equity explanation tip (level 1–4 only, when equity is available) ─────
  if (playerEquity > 0 && state.communityCards.length > 0 && playerLevel <= 4) {
    const equityPct = Math.round(playerEquity * 100)
    const activePlayers = state.players.filter(p => !p.folded && !p.isAllIn).length
    if (playerLevel <= 2) {
      tips.push(makeTip({
        concept: 'hand-strength',
        severity: 'info',
        timing: 'pre-action',
        title: `Your equity: ${equityPct}%`,
        message: `This number is your estimated chance of winning the hand. It's calculated by simulating thousands of random opponent hands. Above 50% means you're the favourite right now.`,
        minLevel: 1,
      }))
    } else {
      // L3–4: explain the mechanics briefly
      const callAmt = Math.min(state.currentBet - human.bet, human.stack)
      const potOddsNeeded = callAmt > 0 ? Math.round((callAmt / (state.pot + callAmt)) * 100) : 0
      tips.push(makeTip({
        concept: 'pot-odds',
        severity: 'info',
        timing: 'pre-action',
        title: `Equity: ${equityPct}% (Monte Carlo)`,
        message: `Computed by running 10,000 simulated runouts against random opponent hands. ${
          potOddsNeeded > 0
            ? `To call profitably here you need ≥${potOddsNeeded}% equity — you have ${equityPct}%.`
            : `Higher equity = stronger position in the hand.`
        } Active opponents: ${activePlayers - 1}.`,
        minLevel: 3,
      }))
    }
  }

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

  // ── Hand strength tip (4 distinct level brackets) ───────────────────────
  if (isConceptUnlocked('hand-strength', playerLevel) && state.communityCards.length > 0) {
    try {
      const result = findBestHand(human.holeCards, state.communityCards)
      const strength = relativeStrength(result.rank)
      const equityPct = Math.round(playerEquity * 100)
      const strengthPct = Math.round(strength * 100)
      const texture = state.communityCards.length >= 3 ? analyzeBoardTexture(state.communityCards) : null

      let msg = ''
      let minLvl = 1

      if (playerLevel <= 2) {
        // L1–2: plain English, no jargon
        if (strength > 0.80) msg = `You have ${result.description} — a very strong hand! Bet to win more chips.`
        else if (strength > 0.55) msg = `You have ${result.description} — a solid hand. You're in good shape.`
        else if (strength > 0.30) msg = `You have ${result.description} — a decent hand, but be careful if someone bets big.`
        else msg = `You have ${result.description} — a weak hand. Think about folding if facing a bet.`
        minLvl = 1
      } else if (playerLevel <= 4) {
        // L3–4: adds equity context
        const edge = equityPct > 50 ? `You're the favourite with ${equityPct}% equity.` : `You're behind with only ${equityPct}% equity.`
        if (strength > 0.65) msg = `${result.description} is a strong hand (${strengthPct}th %ile). ${edge} Betting for value makes sense.`
        else if (strength > 0.35) msg = `${result.description} (${strengthPct}th %ile). ${edge} Play cautiously — call reasonable bets, fold to large ones.`
        else msg = `${result.description} is weak (${strengthPct}th %ile). ${edge} Avoid big commitments unless drawing to something strong.`
        minLvl = 3
      } else if (playerLevel <= 6) {
        // L5–6: adds board texture advice
        const wet = texture?.wetness === 'wet' ? 'wet board — bet to charge draws' : texture?.wetness === 'semi-wet' ? 'semi-wet board' : 'dry board'
        if (strength > 0.65) msg = `${result.description} (${strengthPct}th %ile, ${equityPct}% equity). ${wet}. Bet 60–75% pot for value and protection.`
        else if (strength > 0.35) msg = `${result.description} (${strengthPct}th %ile). ${wet}. Check-call is usually right — avoid bloating the pot with a marginal hand.`
        else msg = `${result.description} (${strengthPct}th %ile, ${equityPct}% equity). You're bluffing territory here. Check or semi-bluff if you have draws.`
        minLvl = 5
      } else {
        // L7–10: concise, strategic
        const action = strength > 0.65 ? 'Value bet or raise frequently' : strength > 0.35 ? 'Pot control — check-call, avoid raising' : 'Bluff candidate or fold vs aggression'
        msg = `${result.description} · ${strengthPct}th %ile · ${equityPct}% equity. ${action}.`
        minLvl = 7
      }

      if (msg) {
        tips.push(makeTip({
          concept: 'hand-strength',
          severity: strength > 0.60 ? 'good' : strength > 0.30 ? 'info' : 'warning',
          timing: 'pre-action',
          title: playerLevel <= 2 ? `Your Hand: ${result.description}` : result.description,
          message: msg,
          minLevel: minLvl,
        }))
      }
    } catch {
      // ignore hand eval errors
    }
  }

  // ── Draw analysis tip (flop + turn, all levels) ─────────────────────────
  if (state.communityCards.length >= 3 && state.communityCards.length < 5) {
    const draws = analyzeDraws(human.holeCards, state.communityCards)
    if (draws.length > 0) {
      const lines = draws.map(d => `${d.description}: ${d.outs} outs (~${d.pct}% to hit)`)
      const hasStrong = draws.some(d => d.outs >= 8)
      tips.push(makeTip({
        concept: 'draws',
        severity: hasStrong ? 'good' : 'info',
        timing: 'pre-action',
        title: draws.length === 1 ? draws[0].description : `${draws.length} draws`,
        message: lines.join('\n'),
        minLevel: 1,
      }))
    }
  }

  // ── Position tip (4 level brackets) ────────────────────────────────────
  if (isConceptUnlocked('position', playerLevel) && state.street === 'preflop') {
    const inPosition = position === 'BTN' || position === 'CO'
    let posMsg = ''
    let posMinLevel = 1

    if (playerLevel <= 2) {
      posMsg = inPosition
        ? `${position} is a great seat — you act last, so you can see what everyone does before you decide.`
        : `${position} means you act before most players. Stick to stronger hands here.`
      posMinLevel = 1
    } else if (playerLevel <= 4) {
      posMsg = inPosition
        ? `Late position (${position}) lets you play more hands profitably — you have information advantage.`
        : `Early position (${position}) requires a tighter range. Avoid speculative hands that are hard to play without info.`
      posMinLevel = 3
    } else if (playerLevel <= 6) {
      posMsg = inPosition
        ? `${position}: widen your opening range and 3-bet lighter. Position is worth 1–2 extra hands per orbit.`
        : `${position}: tighten to ~15% opening range. Out-of-position calls create tough postflop spots you're not paid for.`
      posMinLevel = 5
    } else {
      posMsg = inPosition
        ? `${position}: maximize positional advantage — balanced 3-bet range, wider opens, float more flops in position.`
        : `${position}: strong hands only. Construction of a balanced OOP range requires high hand quality to compensate for the info disadvantage.`
      posMinLevel = 7
    }

    tips.push(makeTip({
      concept: 'position',
      severity: inPosition ? 'good' : 'info',
      timing: 'pre-action',
      title: `Position: ${position}`,
      message: posMsg,
      minLevel: posMinLevel,
    }))
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
