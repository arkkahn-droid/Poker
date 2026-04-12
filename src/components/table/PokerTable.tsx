import { useGameStore, isHumanTurn } from '../../store/gameStore'
import { useGameLoop } from '../../hooks/useGameLoop'
import { useEquity } from '../../hooks/useEquity'
import { PlayerSeat } from './PlayerSeat'
import { CommunityCards } from './CommunityCards'
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
  const { state, playerEquity, equityLoading } = useGameStore()

  useGameLoop()
  useEquity()

  const humanTurn = isHumanTurn(state)
  const showdown = state.street === 'showdown'

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Main table area + action panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Table area */}
        <div className="flex-1 relative">
          {/* Felt table oval */}
          <div className="absolute inset-8 rounded-[50%] bg-emerald-900 border-4 border-emerald-700 shadow-inner flex items-center justify-center">
            {/* Center content */}
            <div className="flex flex-col items-center gap-4">
              {/* Street indicator */}
              <div className="text-sm text-emerald-300 uppercase tracking-widest font-semibold">
                {state.street !== 'idle' ? state.street : ''}
              </div>
              <CommunityCards cards={state.communityCards} pot={state.pot} />

              {/* Equity bar for human */}
              {state.players[0]?.holeCards.length === 2 && state.street !== 'idle' && state.street !== 'showdown' && (
                <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-gray-400">Your equity:</span>
                  {equityLoading ? (
                    <span className="text-xs text-gray-500 animate-pulse">calculating...</span>
                  ) : (
                    <span className={`text-sm font-bold ${playerEquity >= 0.5 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {Math.round(playerEquity * 100)}%
                    </span>
                  )}
                </div>
              )}
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
        </div>

        {/* Action panel — below table, never overlaps */}
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
