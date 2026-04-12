import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { PlayerProgress } from '../types/coaching'

const DEFAULT_PROGRESS: PlayerProgress = {
  level: 1,
  xp: 0,
  handsPlayed: 0,
  handsWon: 0,
  correctFolds: 0,
  incorrectCalls: 0,
  missedValueBets: 0,
  successfulBluffs: 0,
  badBluffs: 0,
  vpip: 0,
  pfr: 0,
  bb100: 0,
}

interface PlayerStore {
  username: string
  progress: PlayerProgress
  bankroll: number
  loaded: boolean

  setUsername: (name: string) => void
  addXP: (amount: number) => void
  recordHand: (won: boolean, vpip: boolean, pfr: boolean, netBB: number) => void
  addCorrectFold: () => void
  addIncorrectCall: () => void
  addMissedValue: () => void
  addSuccessfulBluff: () => void
  addBadBluff: () => void
  updateBankroll: (delta: number) => void
  loadFromDB: (data: Partial<PlayerStore>) => void
}

// XP thresholds to reach each level
export const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 4000, 7000, 11000, 16000]

function computeLevel(xp: number): number {
  let level = 1
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1
    else break
  }
  return Math.min(level, 10)
}

export const usePlayerStore = create<PlayerStore>()(
  immer((set) => ({
    username: 'Player',
    progress: { ...DEFAULT_PROGRESS },
    bankroll: 5000,
    loaded: false,

    setUsername: (name) => {
      set((store) => { store.username = name })
    },

    addXP: (amount) => {
      set((store) => {
        store.progress.xp = Math.max(0, store.progress.xp + amount)
        store.progress.level = computeLevel(store.progress.xp)
      })
    },

    recordHand: (won, vpip, pfr, netBB) => {
      set((store) => {
        const p = store.progress
        p.handsPlayed++
        if (won) p.handsWon++

        // Rolling VPIP and PFR (exponential moving average, window ~100 hands)
        const alpha = Math.min(1, 2 / (p.handsPlayed + 1))
        p.vpip = p.vpip * (1 - alpha) + (vpip ? 1 : 0) * alpha
        p.pfr = p.pfr * (1 - alpha) + (pfr ? 1 : 0) * alpha

        // Rolling BB/100
        p.bb100 = p.bb100 * (1 - alpha) + netBB * alpha * 100
      })
    },

    addCorrectFold: () => set((s) => { s.progress.correctFolds++ }),
    addIncorrectCall: () => set((s) => { s.progress.incorrectCalls++ }),
    addMissedValue: () => set((s) => { s.progress.missedValueBets++ }),
    addSuccessfulBluff: () => set((s) => { s.progress.successfulBluffs++ }),
    addBadBluff: () => set((s) => { s.progress.badBluffs++ }),

    updateBankroll: (delta) => {
      set((store) => { store.bankroll += delta })
    },

    loadFromDB: (data) => {
      set((store) => {
        if (data.username) store.username = data.username
        if (data.progress) store.progress = { ...store.progress, ...data.progress }
        if (data.bankroll !== undefined) store.bankroll = data.bankroll
        store.loaded = true
      })
    },
  })),
)
