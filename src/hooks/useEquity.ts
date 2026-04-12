import { useEffect, useRef } from 'react'
import { wrap } from 'comlink'
import { useGameStore } from '../store/gameStore'
import type { EquityResult } from '../engine/equity'

type EquityWorkerApi = {
  calculateEquity(holeCards: number[][], board: number[], iterations?: number): Promise<EquityResult>
}

let workerInstance: Worker | null = null
let workerApi: EquityWorkerApi | null = null

function getWorker(): EquityWorkerApi {
  if (!workerApi) {
    workerInstance = new Worker(new URL('../workers/equityWorker.ts', import.meta.url), {
      type: 'module',
    })
    workerApi = wrap<EquityWorkerApi>(workerInstance)
  }
  return workerApi
}

export function useEquity() {
  const { state, setEquity, setEquityLoading } = useGameStore()
  const lastCalculationKey = useRef<string>('')

  useEffect(() => {
    const human = state.players[0]
    if (!human || human.holeCards.length < 2) return
    if (state.street === 'idle' || state.street === 'showdown') return

    const activePlayers = state.players.filter((p) => !p.folded && p.holeCards.length === 2)
    if (activePlayers.length < 2) return

    // Create a key to avoid recalculating when nothing changed
    const key = `${state.street}-${state.communityCards.join(',')}-${human.holeCards.join(',')}`
    if (key === lastCalculationKey.current) return
    lastCalculationKey.current = key

    setEquityLoading(true)

    const holeCards = activePlayers.map((p) => p.holeCards)
    const board = state.communityCards

    const api = getWorker()
    api.calculateEquity(holeCards, board, 8000)
      .then((result) => {
        // Index 0 = human player
        const humanIdx = activePlayers.findIndex((p) => p.id === 'human')
        if (humanIdx >= 0) {
          setEquity(result.equities[humanIdx])
        }
      })
      .catch(() => {
        setEquityLoading(false)
      })
  }, [state.street, state.communityCards, state.players, setEquity, setEquityLoading])
}
