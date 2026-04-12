import { useMemo } from 'react'
import { useGameStore } from '../store/gameStore'
import { usePlayerStore } from '../store/playerStore'
import { generateTips } from '../coaching/advisor'
import type { CoachTip } from '../types/coaching'

export function useCoaching(): CoachTip[] {
  const { state, playerEquity } = useGameStore()
  const { progress } = usePlayerStore()

  return useMemo(() => {
    if (state.street === 'idle' || state.street === 'showdown') return []
    if (!state.players[0] || state.players[0].holeCards.length < 2) return []

    return generateTips(state, progress.level, playerEquity)
  }, [state.street, state.actingSeat, state.communityCards, playerEquity, progress.level])
}
