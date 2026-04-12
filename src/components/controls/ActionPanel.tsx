import { useState } from 'react'
import { useGameStore, getCallAmount } from '../../store/gameStore'

export function ActionPanel() {
  const { state, playerAction } = useGameStore()
  const [raiseAmount, setRaiseAmount] = useState<number>(0)
  const [showRaise, setShowRaise] = useState(false)

  const human = state.players[0]
  if (!human) return null

  const callAmount = getCallAmount(state)
  const canCheck = callAmount === 0
  const canCall = callAmount > 0 && callAmount < human.stack
  const canRaise = human.stack > callAmount
  const minRaise = state.minRaise || state.blindLevel * 2
  const maxRaise = human.stack
  const potBet = Math.round(state.pot * 1.0)

  function handleFold() {
    playerAction('fold', 0)
    setShowRaise(false)
  }

  function handleCheck() {
    playerAction('check', 0)
    setShowRaise(false)
  }

  function handleCall() {
    playerAction('call', callAmount)
    setShowRaise(false)
  }

  function handleRaise() {
    if (!showRaise) {
      setRaiseAmount(Math.min(minRaise, maxRaise))
      setShowRaise(true)
      return
    }
    if (raiseAmount >= human.stack) {
      playerAction('allin', human.stack)
    } else {
      playerAction('raise', raiseAmount)
    }
    setShowRaise(false)
  }

  function handleAllIn() {
    playerAction('allin', human.stack)
    setShowRaise(false)
  }

  const presetButtons = [
    { label: '½ Pot', value: Math.max(minRaise, Math.round(potBet * 0.5)) },
    { label: 'Pot', value: Math.max(minRaise, potBet) },
    { label: '2× Pot', value: Math.max(minRaise, potBet * 2) },
    { label: 'All-in', value: maxRaise },
  ]

  return (
    <div className="bg-gray-900/95 border border-gray-700 rounded-2xl p-4 shadow-2xl">
      {/* Raise slider */}
      {showRaise && (
        <div className="mb-4 space-y-3">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Min: ${minRaise}</span>
            <span className="text-white font-bold text-base">${raiseAmount.toLocaleString()}</span>
            <span>Max: ${maxRaise}</span>
          </div>
          <input
            type="range"
            min={minRaise}
            max={maxRaise}
            value={raiseAmount}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
          {/* Preset buttons */}
          <div className="grid grid-cols-4 gap-2">
            {presetButtons.map((btn) => (
              <button
                key={btn.label}
                onClick={() => setRaiseAmount(Math.min(btn.value, maxRaise))}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded px-2 py-1.5 transition-colors"
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {/* Fold */}
        <button
          onClick={handleFold}
          className="flex-1 bg-red-900/80 hover:bg-red-800 border border-red-700 text-red-200 font-semibold rounded-xl px-4 py-3 transition-colors"
        >
          Fold
        </button>

        {/* Check or Call */}
        {canCheck ? (
          <button
            onClick={handleCheck}
            className="flex-1 bg-blue-900/80 hover:bg-blue-800 border border-blue-700 text-blue-200 font-semibold rounded-xl px-4 py-3 transition-colors"
          >
            Check
          </button>
        ) : canCall ? (
          <button
            onClick={handleCall}
            className="flex-1 bg-blue-900/80 hover:bg-blue-800 border border-blue-700 text-blue-200 font-semibold rounded-xl px-4 py-3 transition-colors"
          >
            Call ${callAmount.toLocaleString()}
          </button>
        ) : null}

        {/* Raise/Bet */}
        {canRaise && (
          <button
            onClick={handleRaise}
            className={`flex-1 font-semibold rounded-xl px-4 py-3 transition-colors border ${
              showRaise
                ? 'bg-emerald-700 hover:bg-emerald-600 border-emerald-500 text-white'
                : 'bg-emerald-900/80 hover:bg-emerald-800 border-emerald-700 text-emerald-200'
            }`}
          >
            {showRaise
              ? raiseAmount >= maxRaise ? 'All-In!' : `${canCheck ? 'Bet' : 'Raise'} $${raiseAmount.toLocaleString()}`
              : canCheck ? 'Bet' : 'Raise'}
          </button>
        )}

        {/* All-in shortcut (only when raise panel not shown) */}
        {!showRaise && canRaise && (
          <button
            onClick={handleAllIn}
            className="bg-orange-900/80 hover:bg-orange-800 border border-orange-700 text-orange-200 font-semibold rounded-xl px-3 py-3 text-sm transition-colors"
          >
            All-In
          </button>
        )}
      </div>

      {/* Cancel raise */}
      {showRaise && (
        <button
          onClick={() => setShowRaise(false)}
          className="w-full mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  )
}
