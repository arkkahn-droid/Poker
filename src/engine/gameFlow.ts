import type { GameState, PlayerState, ActionType, ActionRecord, SidePot, Street, TableConfig } from '../types/game'
import { createDeck, shuffle } from './cards'
import { findWinners } from './handEvaluator'

// SNG blind schedule: [handNumber, smallBlind, bigBlind]
export const SNG_BLIND_SCHEDULE: [number, number, number][] = [
  [1, 10, 20],
  [7, 15, 30],
  [13, 25, 50],
  [19, 50, 100],
  [25, 75, 150],
  [31, 100, 200],
  [37, 150, 300],
  [43, 200, 400],
  [49, 300, 600],
  [55, 500, 1000],
]

export function getSNGBlinds(handNumber: number): { sb: number; bb: number } {
  let sb = 10, bb = 20
  for (const [startHand, s, b] of SNG_BLIND_SCHEDULE) {
    if (handNumber >= startHand) { sb = s; bb = b }
    else break
  }
  return { sb, bb }
}

export function getBlindAmounts(state: GameState): { sb: number; bb: number } {
  if (state.gameMode === 'sng') return getSNGBlinds(state.handNumber)
  // Cash: fixed at table config (stored in blindLevel as sb)
  const sb = state.blindLevel
  return { sb, bb: sb * 2 }
}

export function getActivePlayers(players: PlayerState[]): PlayerState[] {
  return players.filter((p) => !p.folded && !p.isAllIn)
}

export function getEligiblePlayers(players: PlayerState[]): PlayerState[] {
  return players.filter((p) => !p.folded)
}

// Next seat index in active rotation (skips folded/all-in players)
export function nextActiveSeat(
  players: PlayerState[],
  fromSeat: number,
  _street?: Street,
): number | null {
  const n = players.length
  for (let i = 1; i < n; i++) {
    const seat = (fromSeat + i) % n
    const p = players[seat]
    if (!p.folded && !p.isAllIn) return seat
  }
  return null // all remaining players are all-in
}

// Create initial player states
export function createPlayers(config: TableConfig, aiNames: string[]): PlayerState[] {
  const players: PlayerState[] = []
  // Seat 0 = human player
  players.push({
    id: 'human',
    name: 'You',
    stack: config.buyIn,
    holeCards: [],
    bet: 0,
    totalInvested: 0,
    folded: false,
    isAllIn: false,
    isHuman: true,
    seatIndex: 0,
  })

  for (let i = 0; i < 5; i++) {
    players.push({
      id: `ai-${i}`,
      name: aiNames[i] ?? `Player ${i + 1}`,
      stack: config.buyIn,
      holeCards: [],
      bet: 0,
      totalInvested: 0,
      folded: false,
      isAllIn: false,
      isHuman: false,
      seatIndex: i + 1,
    })
  }
  return players
}

// Deal a new hand: shuffle, assign hole cards, post blinds, set acting player
export function dealNewHand(state: GameState): GameState {
  const deck = shuffle(createDeck())
  const players = state.players.map((p) => ({
    ...p,
    holeCards: [] as import('../types/cards').Card[],
    bet: 0,
    totalInvested: 0,
    folded: false,
    isAllIn: false,
    lastAction: undefined as ActionRecord | undefined,
  }))

  // Eliminate busted players in SNG
  const activePlayers = players.filter((p) => p.stack > 0)
  if (activePlayers.length < 2) return state // game over

  // Advance dealer button
  const n = players.length
  let newDealerSeat = (state.dealerSeat + 1) % n
  // Skip busted players
  let attempts = 0
  while (players[newDealerSeat].stack === 0 && attempts < n) {
    newDealerSeat = (newDealerSeat + 1) % n
    attempts++
  }

  const { sb, bb } = getBlindAmounts(state)

  // Find SB and BB seats (skip zero-stack players)
  const sbSeat = findNextActiveSeat(players, newDealerSeat, n)
  const bbSeat = findNextActiveSeat(players, sbSeat, n)

  // Post blinds
  players[sbSeat].bet = Math.min(sb, players[sbSeat].stack)
  players[sbSeat].totalInvested = players[sbSeat].bet
  players[sbSeat].stack -= players[sbSeat].bet

  players[bbSeat].bet = Math.min(bb, players[bbSeat].stack)
  players[bbSeat].totalInvested = players[bbSeat].bet
  players[bbSeat].stack -= players[bbSeat].bet

  if (players[sbSeat].stack === 0) players[sbSeat].isAllIn = true
  if (players[bbSeat].stack === 0) players[bbSeat].isAllIn = true

  // Deal 2 hole cards to each player with stack > 0
  let cardIdx = 0
  for (let round = 0; round < 2; round++) {
    for (const p of players) {
      if (p.stack >= 0 || p.totalInvested > 0) {
        const card = deck[cardIdx++]
        if (card !== undefined) p.holeCards.push(card)
      }
    }
  }

  // First to act preflop: UTG = seat after BB
  const utgSeat = findNextActiveSeat(players, bbSeat, n)

  const pot = players[sbSeat].bet + players[bbSeat].bet

  return {
    ...state,
    street: 'preflop',
    communityCards: [],
    pot,
    sidePots: [],
    currentBet: bb,
    minRaise: bb * 2,
    dealerSeat: newDealerSeat,
    smallBlindSeat: sbSeat,
    bigBlindSeat: bbSeat,
    actingSeat: utgSeat,
    players,
    handNumber: state.handNumber + 1,
    handHistory: [],
    showdownResult: null,
    isAnimating: false,
    handStartTime: Date.now(),
  }
}

function findNextActiveSeat(players: PlayerState[], fromSeat: number, n: number): number {
  for (let i = 1; i <= n; i++) {
    const seat = (fromSeat + i) % n
    if (players[seat].stack > 0 || players[seat].totalInvested > 0) return seat
  }
  return (fromSeat + 1) % n
}

// Apply a player action to the game state
export function applyAction(
  state: GameState,
  playerId: string,
  action: ActionType,
  amount: number,
): GameState {
  const players = state.players.map((p) => ({ ...p }))
  const playerIdx = players.findIndex((p) => p.id === playerId)
  if (playerIdx === -1) return state

  const player = players[playerIdx]
  let pot = state.pot
  let currentBet = state.currentBet
  let minRaise = state.minRaise

  const actionRecord: ActionRecord = {
    playerId,
    action,
    amount,
    street: state.street,
    timestamp: Date.now(),
  }

  switch (action) {
    case 'fold':
      player.folded = true
      break

    case 'check':
      // No chips move
      break

    case 'call': {
      const callAmount = Math.min(currentBet - player.bet, player.stack)
      player.stack -= callAmount
      player.bet += callAmount
      player.totalInvested += callAmount
      pot += callAmount
      if (player.stack === 0) player.isAllIn = true
      break
    }

    case 'bet':
    case 'raise': {
      const raiseAmount = Math.min(amount, player.stack)
      const addedToCall = currentBet - player.bet
      const totalAdd = Math.min(raiseAmount + addedToCall, player.stack)
      const newBet = player.bet + totalAdd

      const raiseDiff = newBet - currentBet
      minRaise = newBet + raiseDiff
      currentBet = newBet

      player.stack -= totalAdd
      pot += totalAdd
      player.bet = newBet
      player.totalInvested += totalAdd
      if (player.stack === 0) player.isAllIn = true
      break
    }

    case 'allin': {
      const allInAmount = player.stack
      player.stack = 0
      player.bet += allInAmount
      player.totalInvested += allInAmount
      pot += allInAmount
      player.isAllIn = true

      if (player.bet > currentBet) {
        const raiseDiff = player.bet - currentBet
        minRaise = player.bet + raiseDiff
        currentBet = player.bet
      }
      break
    }
  }

  player.lastAction = actionRecord
  const handHistory = [...state.handHistory, actionRecord]

  // Find next acting player
  const nextSeat = findNextToAct(players, playerIdx, currentBet)

  const newState: GameState = {
    ...state,
    players,
    pot,
    currentBet,
    minRaise,
    actingSeat: nextSeat ?? state.actingSeat,
    handHistory,
  }

  // Check if street is over
  if (nextSeat === null) {
    return advanceStreet({ ...newState, actingSeat: playerIdx })
  }

  return newState
}

function findNextToAct(
  players: PlayerState[],
  lastActedIdx: number,
  currentBet: number,
): number | null {
  const n = players.length

  for (let i = 1; i < n; i++) {
    const seat = (lastActedIdx + i) % n
    const p = players[seat]

    if (p.folded || p.isAllIn) continue

    // Player still needs to act if they haven't matched the current bet
    // or haven't acted yet this street (indicated by lastAction being undefined)
    const needsToAct = p.bet < currentBet || !p.lastAction

    if (needsToAct) return seat
  }

  return null
}

function advanceStreet(state: GameState): GameState {
  const eligible = getEligiblePlayers(state.players)

  // If only one player remains, they win
  if (eligible.length === 1) {
    return awardPot(state, [eligible[0].id])
  }

  // Check if all remaining players are all-in (run it out)
  const canAct = eligible.filter((p) => !p.isAllIn)
  const needsRunout = canAct.length <= 1

  const nextStreet = getNextStreet(state.street)

  if (nextStreet === 'showdown' || (needsRunout && state.street === 'river')) {
    return goToShowdown(state)
  }

  // Deal community cards
  const deck = shuffle(createDeck())
  const usedCards = new Set([
    ...state.communityCards,
    ...state.players.flatMap((p) => p.holeCards),
  ])
  const remainingDeck = deck.filter((c) => !usedCards.has(c))

  const newBoard = [...state.communityCards]
  if (nextStreet === 'flop') newBoard.push(remainingDeck[0], remainingDeck[1], remainingDeck[2])
  else newBoard.push(remainingDeck[0])

  // Reset bets for new street
  const players = state.players.map((p) => ({
    ...p,
    bet: 0,
    lastAction: undefined as ActionRecord | undefined,
  }))

  // First to act postflop: first non-folded player left of dealer
  const firstToAct = findFirstToActPostflop(players, state.dealerSeat)

  if (needsRunout) {
    // Run out remaining streets without action
    return runOutBoard({ ...state, players, communityCards: newBoard, street: nextStreet, currentBet: 0, minRaise: 0 })
  }

  return {
    ...state,
    street: nextStreet,
    communityCards: newBoard,
    currentBet: 0,
    minRaise: state.blindLevel * 2,
    actingSeat: firstToAct,
    players,
  }
}

function runOutBoard(state: GameState): GameState {
  // Complete the board without player action
  const deck = shuffle(createDeck())
  const usedCards = new Set([
    ...state.communityCards,
    ...state.players.flatMap((p) => p.holeCards),
  ])
  const remainingDeck = deck.filter((c) => !usedCards.has(c))

  let board = [...state.communityCards]
  let idx = 0
  while (board.length < 5) {
    board.push(remainingDeck[idx++])
  }

  return goToShowdown({ ...state, communityCards: board })
}

function getNextStreet(current: Street): Street {
  const order: Street[] = ['preflop', 'flop', 'turn', 'river', 'showdown']
  const idx = order.indexOf(current)
  return order[idx + 1] ?? 'showdown'
}

function findFirstToActPostflop(players: PlayerState[], dealerSeat: number): number {
  const n = players.length
  for (let i = 1; i <= n; i++) {
    const seat = (dealerSeat + i) % n
    if (!players[seat].folded && !players[seat].isAllIn) return seat
  }
  return dealerSeat
}

function goToShowdown(state: GameState): GameState {
  const eligible = getEligiblePlayers(state.players)

  const playerHands = eligible.map((p) => ({
    playerId: p.id,
    holeCards: p.holeCards,
  }))

  const ranked = findWinners(playerHands, state.communityCards)

  // Determine winners (handle side pots later — simple pot for now)
  const bestRank = ranked[0].result.rank
  const winners = ranked.filter((r) => r.result.rank === bestRank).map((r) => r.playerId)

  return awardPot(
    { ...state, street: 'showdown' },
    winners,
    ranked[0].result.description,
  )
}

function awardPot(
  state: GameState,
  winnerIds: string[],
  handDescription?: string,
): GameState {
  const share = Math.floor(state.pot / winnerIds.length)
  const players = state.players.map((p) => {
    if (winnerIds.includes(p.id)) {
      return { ...p, stack: p.stack + share }
    }
    return p
  })

  const sidePots = buildSidePots(state.players)

  return {
    ...state,
    street: 'showdown',
    players,
    showdownResult: {
      winnerId: winnerIds,
      amount: state.pot,
      hand: handDescription,
    },
    sidePots,
  }
}

function buildSidePots(players: PlayerState[]): SidePot[] {
  // Simplified side pot calculation
  const eligible = players.filter((p) => !p.folded)
  if (eligible.length <= 1) return []

  const investments = eligible.map((p) => ({ id: p.id, inv: p.totalInvested }))
  investments.sort((a, b) => a.inv - b.inv)

  const pots: SidePot[] = []
  let prevLevel = 0

  for (const { inv } of investments) {
    if (inv <= prevLevel) continue
    const level = inv
    const contribution = level - prevLevel
    const pot: SidePot = {
      amount: 0,
      eligiblePlayerIds: [],
    }
    for (const p of players) {
      const contrib = Math.min(p.totalInvested, level) - Math.min(p.totalInvested, prevLevel)
      pot.amount += contrib
      if (!p.folded && p.totalInvested >= level) {
        pot.eligiblePlayerIds.push(p.id)
      }
    }
    if (contribution > 0) pots.push(pot)
    prevLevel = level
  }

  return pots
}

// Position name for a seat relative to dealer
export function getPositionName(seatIndex: number, dealerSeat: number, playerCount: number): string {
  const relPos = ((seatIndex - dealerSeat) + playerCount) % playerCount
  const names: Record<number, string> = {
    0: 'BTN',
    1: 'SB',
    2: 'BB',
    3: 'UTG',
    4: 'HJ',
    5: 'CO',
  }
  return names[relPos] ?? 'UTG'
}

// Is this position in position (acting last)?
export function isInPosition(seatIndex: number, dealerSeat: number, playerCount: number): boolean {
  const pos = getPositionName(seatIndex, dealerSeat, playerCount)
  return pos === 'BTN' || pos === 'CO'
}
