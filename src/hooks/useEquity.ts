import { useEffect, useRef } from 'react'
import { wrap } from 'comlink'
import { useGameStore } from '../store/gameStore'

type EquityWorkerApi = {
  calculatePlayerEquity(playerCards: number[], board: number[], numOpponents: number, iterations?: number): Promise<number>
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

    const numOpponents = state.players.filter(
      (p) => !p.folded && !p.isHuman && p.holeCards.length === 2,
    ).length
    if (numOpponents === 0) return

    const key = `${state.street}-${state.communityCards.join(',')}-${human.holeCards.join(',')}-${numOpponents}`
    if (key === lastCalculationKey.current) return
    lastCalculationKey.current = key

    setEquityLoading(true)

    const api = getWorker()
    api.calculatePlayerEquity(human.holeCards, state.communityCards, numOpponents, 8000)
      .then((equity) => {
        setEquity(equity)
      })
      .catch(() => {
        setEquityLoading(false)
      })
  }, [state.street, state.communityCards, state.players, setEquity, setEquityLoading])
}
