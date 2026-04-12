import type { Card } from './cards'

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'idle'

export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'bet' | 'allin'

export interface ActionRecord {
  playerId: string
  action: ActionType
  amount: number
  street: Street
  timestamp: number
}

export interface SidePot {
  amount: number
  eligiblePlayerIds: string[]
}

export interface PlayerState {
  id: string
  name: string
  stack: number
  holeCards: Card[]
  bet: number          // current street contribution
  totalInvested: number
  folded: boolean
  isAllIn: boolean
  isHuman: boolean
  seatIndex: number
  lastAction?: ActionRecord
}

export interface ShowdownResult {
  winnerId: string[]   // array for split pots
  amount: number
  hand?: string        // e.g. "Full House, Kings over Aces"
  sidePotResults?: { winnerId: string[]; amount: number }[]
}

export interface GameState {
  phase: 'lobby' | 'game' | 'profile'
  street: Street
  communityCards: Card[]
  pot: number
  sidePots: SidePot[]
  currentBet: number
  minRaise: number
  dealerSeat: number
  smallBlindSeat: number
  bigBlindSeat: number
  actingSeat: number
  players: PlayerState[]
  handNumber: number
  handHistory: ActionRecord[]
  showdownResult: ShowdownResult | null
  isAnimating: boolean
  gameMode: 'cash' | 'sng'
  blindLevel: number       // for SNG escalating blinds
  handStartTime: number
}

export type GameMode = 'cash' | 'sng'

export interface TableConfig {
  gameMode: GameMode
  smallBlind: number
  bigBlind: number
  buyIn: number
  playerCount: number   // always 6 for 6-max
}

export const POSITIONS_6MAX = ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'] as const
export type Position = (typeof POSITIONS_6MAX)[number]
