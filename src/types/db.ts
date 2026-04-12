import type { ActionRecord, ShowdownResult, TableConfig } from './game'
import type { CoachTip } from './coaching'

export interface PlayerProfileRecord {
  id: 1
  username: string
  level: number
  xp: number
  bankroll: number
  handsPlayed: number
  handsWon: number
  vpip: number
  pfr: number
  bb100: number
  correctFolds: number
  incorrectCalls: number
  missedValueBets: number
  successfulBluffs: number
  badBluffs: number
  createdAt: number
  lastPlayedAt: number
}

export interface SessionRecord {
  id?: number
  startedAt: number
  endedAt: number
  tableConfig: TableConfig
  handsPlayed: number
  startStack: number
  endStack: number
  xpEarned: number
  gameMode: 'cash' | 'sng'
}

export interface HandRecord {
  id?: number
  sessionId: number
  handNumber: number
  playedAt: number
  holeCards: number[]
  communityCards: number[]
  position: string
  actions: ActionRecord[]
  result: ShowdownResult | null
  netResult: number       // chips won/lost this hand
  coachTips: CoachTip[]
  xpAwarded: number
  vpip: boolean
  pfr: boolean
  wentToShowdown: boolean
  wonAtShowdown: boolean
  potSize: number
}
