import { useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { usePlayerStore } from '../../store/playerStore'
import { ARCHETYPES, DEFAULT_TABLE_ARCHETYPES } from '../../ai/archetypes'
import type { TableConfig, GameMode } from '../../types/game'

const CASH_STAKES = [
  { label: '$1/$2', sb: 1, bb: 2, buyIn: 200 },
  { label: '$2/$5', sb: 2, bb: 5, buyIn: 500 },
  { label: '$5/$10', sb: 5, bb: 10, buyIn: 1000 },
  { label: '$10/$20', sb: 10, bb: 20, buyIn: 2000 },
]

const SNG_BUYINS = [
  { label: '$50 SNG', buyIn: 1500, sb: 10, bb: 20 },
  { label: '$100 SNG', buyIn: 3000, sb: 25, bb: 50 },
  { label: '$200 SNG', buyIn: 5000, sb: 50, bb: 100 },
]

export function Lobby() {
  const { startGame } = useGameStore()
  const { progress, username, setUsername } = usePlayerStore()
  const [gameMode, setGameMode] = useState<GameMode>('cash')
  const [selectedStake, setSelectedStake] = useState(CASH_STAKES[2])
  const [selectedSNG, setSelectedSNG] = useState(SNG_BUYINS[0])
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(username)

  function handleStart() {
    const config: TableConfig =
      gameMode === 'cash'
        ? { gameMode, smallBlind: selectedStake.sb, bigBlind: selectedStake.bb, buyIn: selectedStake.buyIn, playerCount: 6 }
        : { gameMode, smallBlind: selectedSNG.sb, bigBlind: selectedSNG.bb, buyIn: selectedSNG.buyIn, playerCount: 6 }

    startGame(config)
  }

  function saveName() {
    setUsername(nameInput.trim() || 'Player')
    setEditingName(false)
  }

  const levelNames = ['', 'Beginner', 'Novice', 'Developing', 'Solid', 'Competent', 'Skilled', 'Advanced', 'Expert', 'Elite', 'Master']

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-1">Poker Coach</h1>
          <p className="text-gray-500 text-sm">Texas Hold'em · 6-Max · Adaptive Coaching</p>
        </div>

        {/* Player info */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-blue-900 flex items-center justify-center text-2xl font-bold text-blue-300">
            {username[0]?.toUpperCase() ?? 'P'}
          </div>
          <div className="flex-1">
            {editingName ? (
              <div className="flex gap-2">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-white text-sm flex-1"
                  autoFocus
                />
                <button onClick={saveName} className="text-xs text-emerald-400 px-2">Save</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">{username}</span>
                <button onClick={() => setEditingName(true)} className="text-xs text-gray-600 hover:text-gray-400">edit</button>
              </div>
            )}
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-emerald-400 font-medium">Level {progress.level} · {levelNames[progress.level]}</span>
              <span className="text-xs text-gray-600">{progress.xp.toLocaleString()} XP</span>
              <span className="text-xs text-gray-600">{progress.handsPlayed} hands</span>
            </div>
          </div>
        </div>

        {/* Mode selection */}
        <div className="grid grid-cols-2 gap-3">
          {(['cash', 'sng'] as GameMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setGameMode(mode)}
              className={`rounded-xl border p-4 text-left transition-all ${
                gameMode === mode
                  ? 'border-emerald-500 bg-emerald-950/40 text-white'
                  : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'
              }`}
            >
              <div className="font-semibold text-sm mb-1">
                {mode === 'cash' ? '💵 Cash Game' : '🏆 Sit & Go'}
              </div>
              <div className="text-xs text-gray-500">
                {mode === 'cash'
                  ? 'Fixed blinds. Buy in and leave anytime.'
                  : 'Escalating blinds. Play to the end.'}
              </div>
            </button>
          ))}
        </div>

        {/* Stakes selection */}
        <div>
          <div className="text-xs text-gray-600 uppercase tracking-wider mb-2">
            {gameMode === 'cash' ? 'Stakes' : 'Tournament'}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(gameMode === 'cash' ? CASH_STAKES : SNG_BUYINS).map((stake) => {
              const isSelected = gameMode === 'cash'
                ? selectedStake.label === stake.label
                : selectedSNG.label === stake.label
              return (
                <button
                  key={stake.label}
                  onClick={() => {
                    if (gameMode === 'cash') setSelectedStake(stake as typeof CASH_STAKES[number])
                    else setSelectedSNG(stake as typeof SNG_BUYINS[number])
                  }}
                  className={`rounded-lg border px-4 py-3 text-sm transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-950/40 text-white'
                      : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="font-medium">{stake.label}</div>
                  <div className="text-xs text-gray-500">Buy-in: ${stake.buyIn.toLocaleString()}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Opponents preview */}
        <div>
          <div className="text-xs text-gray-600 uppercase tracking-wider mb-2">Your opponents</div>
          <div className="grid grid-cols-5 gap-2">
            {DEFAULT_TABLE_ARCHETYPES.map((id, i) => {
              const arch = ARCHETYPES[id]
              return (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-2 text-center">
                  <div className="text-lg mb-1">
                    {id === 'nit' ? '🪨' : id === 'tag' ? '🎯' : id === 'lag' ? '⚡' : id === 'callingstation' ? '📞' : '🌪️'}
                  </div>
                  <div className="text-xs font-medium text-gray-300">{arch.name}</div>
                  <div className="text-xs text-gray-600 truncate">{arch.description.split('.')[0]}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl py-4 text-lg transition-colors shadow-lg shadow-emerald-900/50"
        >
          Deal Cards
        </button>
      </div>
    </div>
  )
}
