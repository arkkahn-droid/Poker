import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { GameState, ActionType, TableConfig } from '../types/game'
import type { AIPlayer } from '../types/ai'
import { dealNewHand, applyAction, createPlayers, getPositionName } from '../engine/gameFlow'
import { makeDecision } from '../ai/decisionEngine'
import { ARCHETYPES, DEFAULT_TABLE_ARCHETYPES, AI_NAMES } from '../ai/archetypes'
import { findBestHand, relativeStrength } from '../engine/handEvaluator'
import type { ArchetypeId } from '../types/ai'
import { usePlayerStore } from './playerStore'

const DEFAULT_CONFIG: TableConfig = {
  gameMode: 'cash',
  smallBlind: 5,
  bigBlind: 10,
  buyIn: 1000,
  playerCount: 6,
}

function createAIPlayers(): AIPlayer[] {
  return DEFAULT_TABLE_ARCHETYPES.map((archetypeId, i) => {
    const archetype = ARCHETYPES[archetypeId as ArchetypeId]
    const names = AI_NAMES[archetypeId as ArchetypeId]
    return {
      id: `ai-${i}`,
      name: names[i % names.length],
      archetype,
      seatIndex: i + 1,
    }
  })
}

const INITIAL_STATE: GameState = {
  phase: 'lobby',
  street: 'idle',
  communityCards: [],
  pot: 0,
  sidePots: [],
  currentBet: 0,
  minRaise: 0,
  dealerSeat: 0,
  smallBlindSeat: 1,
  bigBlindSeat: 2,
  actingSeat: 0,
  players: [],
  handNumber: 0,
  handHistory: [],
  showdownResult: null,
  isAnimating: false,
  gameMode: 'cash',
  blindLevel: 5, // small blind amount
  handStartTime: 0,
}

interface GameStore {
  state: GameState
  aiPlayers: AIPlayer[]
  tableConfig: TableConfig
  playerEquity: number
  equityLoading: boolean

  // Actions
  startGame: (config: TableConfig) => void
  dealHand: () => void
  playerAction: (action: ActionType, amount: number) => void
  aiAction: (playerId: string) => void
  nudgeActingPlayer: () => void
  setEquity: (equity: number) => void
  setEquityLoading: (loading: boolean) => void
  goToLobby: () => void
  goToProfile: () => void
}

export const useGameStore = create<GameStore>()(
  immer((set, get) => ({
    state: INITIAL_STATE,
    aiPlayers: createAIPlayers(),
    tableConfig: DEFAULT_CONFIG,
    playerEquity: 0,
    equityLoading: false,

    startGame: (config: TableConfig) => {
      const aiPlayers = createAIPlayers()
      const aiNames = aiPlayers.map((p) => p.name)
      const players = createPlayers(config, aiNames)

      set((store) => {
        store.aiPlayers = aiPlayers
        store.tableConfig = config
        store.state = {
          ...INITIAL_STATE,
          phase: 'game',
          gameMode: config.gameMode,
          blindLevel: config.smallBlind,
          players,
        }
      })

      // Start first hand
      get().dealHand()
    },

    dealHand: () => {
      set((store) => {
        const newState = dealNewHand(store.state)
        store.state = newState
        store.playerEquity = 0
        store.equityLoading = true
      })
    },

    playerAction: (action: ActionType, amount: number) => {
      const prevStreet = get().state.street
      set((store) => {
        store.state = applyAction(store.state, 'human', action, amount)
      })
      if (prevStreet !== 'showdown' && get().state.street === 'showdown') {
        recordHandResult(get().state, get().tableConfig)
      }
    },

    aiAction: (playerId: string) => {
      const { state, aiPlayers } = get()
      const aiPlayer = aiPlayers.find((p) => p.id === playerId)
      if (!aiPlayer) return

      // Use a rough equity estimate for AI decisions (not Monte Carlo for performance)
      const roughEquity = estimateRoughEquity(state, playerId)
      let decision
      try {
        decision = makeDecision(aiPlayer, state, roughEquity)
      } catch {
        decision = { action: 'fold' as ActionType, amount: 0, delayMs: 0 }
      }

      const prevStreet = get().state.street
      set((store) => {
        store.state = applyAction(
          store.state,
          playerId,
          decision.action as ActionType,
          decision.amount,
        )
      })
      if (prevStreet !== 'showdown' && get().state.street === 'showdown') {
        recordHandResult(get().state, get().tableConfig)
      }
    },

    nudgeActingPlayer: () => {
      const { state } = get()
      const p = state.players[state.actingSeat]
      if (!p || p.isHuman || p.folded) return
      // Bypass makeDecision entirely — check if no bet to face, else fold
      const action: ActionType = state.currentBet > p.bet ? 'fold' : 'check'
      const prevStreet = state.street
      set((store) => {
        store.state = applyAction(store.state, p.id, action, 0)
      })
      if (prevStreet !== 'showdown' && get().state.street === 'showdown') {
        recordHandResult(get().state, get().tableConfig)
      }
    },

    setEquity: (equity: number) => {
      set((store) => {
        store.playerEquity = equity
        store.equityLoading = false
      })
    },

    setEquityLoading: (loading: boolean) => {
      set((store) => {
        store.equityLoading = loading
      })
    },

    goToLobby: () => {
      set((store) => {
        store.state = { ...INITIAL_STATE, phase: 'lobby' }
      })
    },

    goToProfile: () => {
      set((store) => {
        store.state.phase = 'profile'
      })
    },
  })),
)

// Record completed hand stats into playerStore
function recordHandResult(state: GameState, config: TableConfig) {
  const { addXP, recordHand, updateBankroll } = usePlayerStore.getState()
  const human = state.players[0]
  if (!human || !state.showdownResult) return

  const won = state.showdownResult.winnerId.includes('human')
  const vpip = state.handHistory.some(
    (a) => a.playerId === 'human' && a.street === 'preflop' &&
      ['call', 'raise', 'bet', 'allin'].includes(a.action),
  )
  const pfr = state.handHistory.some(
    (a) => a.playerId === 'human' && a.street === 'preflop' &&
      ['raise', 'bet', 'allin'].includes(a.action),
  )

  const bb = config.bigBlind
  const winners = state.showdownResult.winnerId
  const potShare = won ? Math.floor(state.showdownResult.amount / winners.length) : 0
  const netChips = potShare - human.totalInvested
  const netBB = netChips / bb

  recordHand(won, vpip, pfr, netBB)
  updateBankroll(netChips)
  addXP(won ? 4 : 2)
}

// Rough equity estimate for AI (without Monte Carlo for speed)
// Uses hand rank relative strength as a proxy
function estimateRoughEquity(state: GameState, playerId: string): number {
  const player = state.players.find((p) => p.id === playerId)
  if (!player || player.holeCards.length < 2) return 0.3

  try {
    if (state.communityCards.length > 0) {
      const result = findBestHand(player.holeCards, state.communityCards)
      const activeCount = state.players.filter((p) => !p.folded).length
      // Adjust for number of opponents (more opponents = lower equity)
      return relativeStrength(result.rank) * (1 / Math.max(1, activeCount - 1)) * 1.5
    }
  } catch {
    // ignore
  }

  return 0.35
}

// Helper: get human player position name
export function getHumanPosition(state: GameState): string {
  return getPositionName(0, state.dealerSeat, state.players.length)
}

// Helper: is it the human's turn?
export function isHumanTurn(state: GameState): boolean {
  return state.actingSeat === 0 &&
    state.street !== 'idle' &&
    state.street !== 'showdown' &&
    !state.players[0]?.folded
}

// Helper: get call amount for human
export function getCallAmount(state: GameState): number {
  const human = state.players[0]
  if (!human) return 0
  return Math.min(state.currentBet - human.bet, human.stack)
}
