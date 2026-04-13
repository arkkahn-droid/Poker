import { useEffect, useRef } from 'react'
import { useGameStore, isHumanTurn } from '../store/gameStore'

// Drives the AI action loop with timing delays
export function useGameLoop() {
  const { state, aiAction } = useGameStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    // After showdown, wait for human to click "Deal next hand" — do not auto-advance
    if (state.street === 'showdown') return

    if (state.street === 'idle' || state.phase !== 'game') return

    // If human's turn, do nothing — wait for player input
    if (isHumanTurn(state)) return

    // Find the acting AI player
    const actingPlayer = state.players[state.actingSeat]

    // Safety net: if actingSeat points to a player who can't act (eliminated, folded, all-in),
    // skip their turn by having them fold — prevents permanent hangs
    if (!actingPlayer || actingPlayer.folded || actingPlayer.isAllIn || actingPlayer.stack === 0) {
      if (!actingPlayer?.isHuman) {
        timerRef.current = setTimeout(() => {
          const current = useGameStore.getState().state
          const seat = current.actingSeat
          const p = current.players[seat]
          if (p && !p.isHuman && !p.folded && !p.isAllIn && p.stack === 0) {
            useGameStore.getState().playerAction('fold', 0)
          }
        }, 50)
      }
      return
    }

    if (actingPlayer.isHuman) return

    // Find the AI player config to get timing delay
    const { aiPlayers } = useGameStore.getState()
    const aiConfig = aiPlayers.find((p) => p.id === actingPlayer.id)
    const delayMs = aiConfig
      ? Math.max(400, Math.min(3000, aiConfig.archetype.timingMeanMs * (0.5 + Math.random())))
      : 800

    timerRef.current = setTimeout(() => {
      aiAction(actingPlayer.id)
    }, delayMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [state.actingSeat, state.street, state.phase, state.showdownResult])
}
