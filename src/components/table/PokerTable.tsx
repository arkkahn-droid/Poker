import { useGameStore, isHumanTurn } from '../../store/gameStore'
import { useGameLoop } from '../../hooks/useGameLoop'
import { useEquity } from '../../hooks/useEquity'
import { useCoaching } from '../../hooks/useCoaching'
import { usePlayerStore } from '../../store/playerStore'
import { PlayingCard } from '../cards/PlayingCard'
import { ActionPanel } from '../controls/ActionPanel'
import { getPositionName } from '../../engine/gameFlow'
import { getLevelInfo, levelProgressPercent } from '../../coaching/levels'
import type { TipSeverity } from '../../types/coaching'

export function PokerTable() {
  const { state, playerEquity, equityLoading, nudgeActingPlayer, dealHand } = useGameStore()
  const { progress } = usePlayerStore()
  const tips = useCoaching()

  useGameLoop()
  useEquity()

  const humanTurn = isHumanTurn(state)
  const showdown = state.street === 'showdown'
  const showBoard = state.street !== 'idle'
  const human = state.players[0]
  const aiPlayers = state.players.filter((p) => !p.isHuman)
  const position = human ? getPositionName(0, state.dealerSeat, state.players.length) : ''
  const levelInfo = getLevelInfo(progress.level)
  const progressPct = levelProgressPercent(progress.xp, progress.level)
  const showEquity = human?.holeCards.length === 2 && !showdown && state.street !== 'idle'
  const activePlayers = state.players.filter((p) => p.stack > 0)
  const gameOver = showdown && activePlayers.length < 2

  return (
    <div className="flex flex-col h-[100svh] bg-gray-950 overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-900">
        <span className="text-[11px] text-gray-500">Hand #{state.handNumber}</span>
        <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
          {state.street !== 'idle' ? state.street : ''}
        </span>
        <span className="text-[11px] text-gray-500">Lv {progress.level} · {progress.xp} XP</span>
      </div>

      {/* ── AI players list ── */}
      <div className="flex-shrink-0 divide-y divide-gray-800/50">
        {aiPlayers.map((player) => {
          const isActing = state.actingSeat === player.seatIndex
            && state.street !== 'idle'
            && state.street !== 'showdown'
          const isFolded = player.folded
          const isDealer = state.dealerSeat === player.seatIndex

          return (
            <div
              key={player.id}
              className={`flex items-center gap-2 px-3 py-2 ${isActing ? 'bg-yellow-950/40' : ''}`}
            >
              {/* Acting dot */}
              <div className="w-2 flex-shrink-0 flex items-center justify-center">
                {isActing && (
                  <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                )}
              </div>

              {/* Name + stack */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-sm font-medium ${isFolded ? 'text-gray-600' : 'text-gray-200'}`}>
                    {player.name}
                  </span>
                  {isDealer && (
                    <span className="text-[9px] bg-yellow-600 text-yellow-100 rounded-full px-1.5 py-px font-bold">D</span>
                  )}
                  {player.isAllIn && !isFolded && (
                    <span className="text-[9px] text-orange-400 font-semibold">ALL-IN</span>
                  )}
                </div>
                <div className="text-xs text-gray-600">
                  {isFolded
                    ? 'Folded'
                    : `$${player.stack.toLocaleString()}${player.bet > 0 ? ` · $${player.bet} in` : ''}`}
                </div>
              </div>

              {/* Cards */}
              {!isFolded && (
                <div className="flex gap-1 items-center">
                  {showdown && player.holeCards.length === 2
                    ? player.holeCards.map((card, i) => (
                        <PlayingCard key={i} card={card} small />
                      ))
                    : (
                      <>
                        <div className="w-7 h-10 rounded-md bg-blue-800 border border-blue-600 shadow" />
                        <div className="w-7 h-10 rounded-md bg-blue-800 border border-blue-600 shadow" />
                      </>
                    )}
                </div>
              )}

              {/* Skip button when stuck */}
              {isActing && (
                <button
                  onClick={nudgeActingPlayer}
                  className="text-[9px] text-gray-700 hover:text-gray-400 border border-gray-800 hover:border-gray-600 rounded px-1.5 py-0.5 ml-1 transition-colors"
                >
                  skip
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Board + pot ── */}
      {showBoard && (
        <div className="flex-shrink-0 border-y border-gray-800 bg-gray-900 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex gap-1 items-center">
            {[0, 1, 2, 3, 4].map((i) =>
              state.communityCards[i] !== undefined ? (
                <PlayingCard key={i} card={state.communityCards[i]} small />
              ) : (
                <div key={i} className="w-7 h-10 rounded border border-dashed border-gray-700 opacity-20" />
              )
            )}
          </div>
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
            <span className="text-sm font-bold text-yellow-300">${state.pot.toLocaleString()}</span>
            {showEquity && (
              equityLoading
                ? <span className="text-[10px] text-gray-500 animate-pulse">calc…</span>
                : <span className={`text-xs font-bold ${playerEquity >= 0.5 ? 'text-emerald-400' : 'text-red-400'}`}>
                    Eq {Math.round(playerEquity * 100)}%
                  </span>
            )}
          </div>
        </div>
      )}

      {/* ── Your section ── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-3 min-h-0">
        {/* Showdown result */}
        {showdown && state.showdownResult && (
          <div className="text-center px-4">
            <div className="text-base font-bold text-yellow-300">
              {state.showdownResult.winnerId.includes('human')
                ? 'You won!'
                : `${state.players.find((p) => p.id === state.showdownResult?.winnerId[0])?.name ?? 'Opponent'} wins`}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              ${state.showdownResult.amount} · {state.showdownResult.hand ?? ''}
            </div>
          </div>
        )}

        {/* Your hole cards */}
        {human && human.holeCards.length === 2 && (
          <div className="flex gap-3">
            {human.holeCards.map((card, i) => (
              <PlayingCard key={i} card={card} />
            ))}
          </div>
        )}

        {/* Your info */}
        {human && (
          <div className="text-center">
            <div className="text-sm text-gray-300">
              You · {position}
              {state.dealerSeat === 0 && (
                <span className="ml-1.5 text-[9px] bg-yellow-600 text-yellow-100 rounded-full px-1.5 py-px font-bold">D</span>
              )}
            </div>
            <div className="text-xs text-gray-500">
              ${human.stack.toLocaleString()}
              {human.bet > 0 && ` · $${human.bet} in`}
              {human.isAllIn && ' · ALL-IN'}
              {human.folded && ' · Folded'}
            </div>
          </div>
        )}

        {/* Deal next hand / game over */}
        {showdown && (
          gameOver
            ? <div className="text-sm text-gray-400 font-semibold mt-1">Game over</div>
            : <button
                onClick={dealHand}
                className="mt-1 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                Deal next hand
              </button>
        )}
      </div>

      {/* ── Tips + XP strip ── */}
      <div className="flex-shrink-0 border-t border-gray-800 bg-gray-900/90 px-3 pt-2 pb-1 max-h-40 overflow-y-auto">
        {tips.length > 0 ? (
          <div className="space-y-2 mb-2">
            {tips.map((tip) => (
              <div key={tip.id} className="flex items-start gap-1.5">
                <span className="text-xs flex-shrink-0 mt-px">{tipIcon(tip.severity)}</span>
                <div className="min-w-0">
                  <span className={`text-[11px] font-semibold ${tipColor(tip.severity)}`}>{tip.title}: </span>
                  <span className="text-[11px] text-gray-300 leading-relaxed">{tip.message}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-gray-600 text-center py-1">
            {showdown ? 'Hand complete' : state.street === 'idle' ? 'Ready' : 'Watching…'}
          </div>
        )}
        {/* Level progress bar */}
        <div className="flex items-center gap-2 py-1 border-t border-gray-800/50 mt-1">
          <span className="text-[9px] text-gray-600 flex-shrink-0">{levelInfo.name}</span>
          <div className="flex-1 h-0.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-[9px] text-gray-600 flex-shrink-0">{progress.xp} XP</span>
        </div>
      </div>

      {/* ── Action panel ── */}
      {humanTurn && (
        <div className="flex-shrink-0 border-t border-gray-800 bg-gray-950 px-3 py-2">
          <ActionPanel />
        </div>
      )}

    </div>
  )
}

function tipIcon(severity: TipSeverity): string {
  switch (severity) {
    case 'good': return '✓'
    case 'warning': return '⚠'
    case 'mistake': return '✗'
    default: return 'ℹ'
  }
}

function tipColor(severity: TipSeverity): string {
  switch (severity) {
    case 'good': return 'text-emerald-400'
    case 'warning': return 'text-yellow-400'
    case 'mistake': return 'text-red-400'
    default: return 'text-blue-400'
  }
}
