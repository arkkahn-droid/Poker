export type TipSeverity = 'good' | 'info' | 'warning' | 'mistake'
export type TipTiming = 'pre-action' | 'post-action' | 'post-hand'
export type ConceptId =
  | 'hand-strength'
  | 'pot-odds'
  | 'position'
  | 'board-texture'
  | 'hand-ranges'
  | 'bluffing'
  | 'bet-sizing'
  | 'meta-game'

export interface CoachTip {
  id: string
  concept: ConceptId
  severity: TipSeverity
  timing: TipTiming
  title: string
  message: string
  detail?: string   // expanded explanation shown on click
  minLevel: number  // only shown at this level and above
  xpDelta?: number  // XP awarded or deducted
}

export interface CoachLevel {
  level: number
  name: string
  description: string
  xpRequired: number   // cumulative XP to reach this level
  unlockedConcepts: ConceptId[]
}

export interface PlayerProgress {
  level: number
  xp: number
  handsPlayed: number
  handsWon: number
  correctFolds: number
  incorrectCalls: number
  missedValueBets: number
  successfulBluffs: number
  badBluffs: number
  vpip: number    // rolling %
  pfr: number
  bb100: number   // BB/100 hands
}
