import { useEffect, useRef } from 'react'
import { useGameStore, isHumanTurn } from '../store/gameStore'

// Drives the AI action loop with timing delays
export function useGameLoop() {
  const { state, aiAction } = useGameStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current)
      watchdogRef.current = null
    }

    // After showdown, wait for human to click "Deal next hand" — do not auto-advance
    if (state.street === 'showdown') return

    if (state.street === 'idle' || state.phase !== 'game') return

    // If human's turn, do nothing — wait for player input
    if (isHumanTurn(state)) return

    // Find the acting AI player
    const actingPlayer = state.players[state.actingSeat]

    // Safety net: if actingSeat points to a player who can't act (eliminated, folded, all-in),
    // advance the game by applying a check (which gameFlow will immediately forward)
    if (!actingPlayer || actingPlayer.folded || actingPlayer.isAllIn || actingPlayer.stack === 0) {
      timerRef.current = setTimeout(() => {
        const s = useGameStore.getState().state
        const p = s.players[s.actingSeat]
        // Force a check action to unstick — gameFlow will advance to next player/street
        if (p && !p.isHuman) {
          useGameStore.getState().aiAction(p.id)
        }
      }, 100)
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

    // Watchdog: if AI hasn't acted after 6s, force a fold to unstick
    watchdogRef.current = setTimeout(() => {
      const s = useGameStore.getState().state
      if (s.street === 'showdown' || s.street === 'idle') return
      const p = s.players[s.actingSeat]
      if (p && !p.isHuman && !p.folded) {
        useGameStore.getState().playerAction('fold', 0)
      }
    }, 6000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (watchdogRef.current) clearTimeout(watchdogRef.current)
    }
  }, [state.actingSeat, state.street, state.phase, state.showdownResult])
}
