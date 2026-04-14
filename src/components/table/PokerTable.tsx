import { useGameStore, isHumanTurn } from '../../store/gameStore'
import { useGameLoop } from '../../hooks/useGameLoop'
import { useEquity } from '../../hooks/useEquity'
import { PlayerSeat } from './PlayerSeat'
import { PlayingCard } from '../cards/PlayingCard'
import { ActionPanel } from '../controls/ActionPanel'
import { CoachPanel } from '../coach/CoachPanel'
import { ShowdownOverlay } from './ShowdownOverlay'
// Seat positions around the table (CSS positions as percentages)
// Seat 0 = human (bottom center), 1-5 = AI players
const SEAT_POSITIONS = [
  { bottom: '2%', left: '50%', transform: 'translateX(-50%)' },   // 0 = human, bottom
  { bottom: '30%', left: '5%' },                                    // 1 = left
  { top: '5%', left: '15%' },                                       // 2 = top-left
  { top: '5%', left: '50%', transform: 'translateX(-50%)' },        // 3 = top-center
  { top: '5%', right: '15%' },                                      // 4 = top-right
  { bottom: '30%', right: '5%' },                                   // 5 = right
]

export function PokerTable() {
  const { state, playerEquity, equityLoading, aiAction } = useGameStore()

  useGameLoop()
  useEquity()

  const humanTurn = isHumanTurn(state)
  const showdown = state.street === 'showdown'
  const showBoard = state.street !== 'idle'
  const showEquity = state.players[0]?.holeCards.length === 2 && !showdown && state.street !== 'idle'

  // Show nudge button when it's an AI's turn (not human, not idle, not showdown)
  const aiTurn = !humanTurn && state.street !== 'idle' && state.street !== 'showdown'
  const actingPlayer = state.players[state.actingSeat]

  function nudgeAI() {
    if (actingPlayer && !actingPlayer.isHuman) {
      aiAction(actingPlayer.id)
    }
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Main table area + board strip + action panel */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Table oval with seats — no cards inside */}
        <div className="flex-1 relative min-h-0">
          {/* Felt oval — pure decoration */}
          <div className="absolute inset-8 rounded-[50%] bg-emerald-900 border-4 border-emerald-700 shadow-inner flex items-center justify-center">
            <div className="text-xs text-emerald-600 uppercase tracking-widest font-semibold select-none">
              {state.street !== 'idle' && state.street !== 'showdown' ? state.street : ''}
            </div>
          </div>

          {/* Player seats */}
          {state.players.map((player, i) => (
            <div
              key={player.id}
              className="absolute"
              style={SEAT_POSITIONS[i] as React.CSSProperties}
            >
              <PlayerSeat
                player={player}
                dealerSeat={state.dealerSeat}
                totalPlayers={state.players.length}
                isActing={state.actingSeat === i && state.street !== 'idle' && state.street !== 'showdown'}
                showCards={showdown}
                compact={!player.isHuman}
              />
            </div>
          ))}

          {/* Showdown overlay */}
          {showdown && state.showdownResult && (
            <ShowdownOverlay result={state.showdownResult} />
          )}

          {/* Hand number */}
          <div className="absolute top-3 left-4 text-xs text-gray-600">
            Hand #{state.handNumber}
          </div>

          {/* Nudge button — tap if an AI player appears stuck */}
          {aiTurn && (
            <button
              onClick={nudgeAI}
              className="absolute bottom-3 right-3 text-[10px] text-gray-600 hover:text-gray-400 border border-gray-700 hover:border-gray-500 rounded px-2 py-1 transition-colors"
            >
              stuck? tap
            </button>
          )}
        </div>

        {/* Board strip — dedicated row, never covered by seats */}
        {showBoard && (
          <div className="flex-shrink-0 border-t border-gray-800 bg-gray-900 px-3 py-2 flex items-center justify-between gap-3">
            {/* Community cards */}
            <div className="flex gap-1.5 items-center">
              {[0, 1, 2, 3, 4].map((i) =>
                state.communityCards[i] !== undefined ? (
                  <PlayingCard key={i} card={state.communityCards[i]} small />
                ) : (
                  <div key={i} className="w-9 h-[52px] rounded border border-dashed border-gray-700 opacity-20" />
                )
              )}
            </div>

            {/* Pot + equity */}
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              <span className="text-sm font-bold text-yellow-300">
                ${state.pot.toLocaleString()}
              </span>
              {showEquity && (
                equityLoading ? (
                  <span className="text-[10px] text-gray-500 animate-pulse">calculating…</span>
                ) : (
                  <span className={`text-xs font-bold ${playerEquity >= 0.5 ? 'text-emerald-400' : 'text-red-400'}`}>
                    Eq {Math.round(playerEquity * 100)}%
                  </span>
                )
              )}
            </div>
          </div>
        )}

        {/* Action panel — below board strip, never overlaps */}
        {humanTurn && (
          <div className="flex-shrink-0 border-t border-gray-800 bg-gray-950 px-4 py-3">
            <ActionPanel />
          </div>
        )}
      </div>

      {/* Coach panel (right sidebar) */}
      <div className="w-56 border-l border-gray-800 bg-gray-900 flex flex-col overflow-hidden">
        <CoachPanel />
      </div>
    </div>
  )
}
