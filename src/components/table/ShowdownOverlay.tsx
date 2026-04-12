import type { ShowdownResult } from '../../types/game'
import { useGameStore } from '../../store/gameStore'

interface ShowdownOverlayProps {
  result: ShowdownResult
}

export function ShowdownOverlay({ result }: ShowdownOverlayProps) {
  const { state, dealHand } = useGameStore()

  const humanWon = result.winnerId.includes('human')
  const winnerNames = result.winnerId.map((id) => {
    if (id === 'human') return 'You'
    const p = state.players.find((p) => p.id === id)
    return p?.name ?? id
  })

  const activePlayers = state.players.filter((p) => p.stack > 0)
  const gameOver = activePlayers.length < 2

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        className={`rounded-2xl border px-8 py-5 text-center shadow-2xl backdrop-blur-sm ${
          humanWon
            ? 'bg-emerald-900/80 border-emerald-400'
            : 'bg-gray-900/80 border-gray-600'
        }`}
      >
        {humanWon ? (
          <div className="text-3xl font-bold text-emerald-300 mb-1">You won!</div>
        ) : (
          <div className="text-2xl font-bold text-gray-300 mb-1">
            {winnerNames.join(' & ')} won
          </div>
        )}
        {result.hand && (
          <div className="text-base text-yellow-300">{result.hand}</div>
        )}
        <div className="text-sm text-gray-400 mt-1">
          ${result.amount.toLocaleString()} pot
        </div>

        {gameOver ? (
          <div className="text-sm text-gray-400 mt-3 font-semibold">Game over</div>
        ) : (
          <button
            onClick={dealHand}
            className="mt-4 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Deal next hand
          </button>
        )}
      </div>
    </div>
  )
}
