import { useCoaching } from '../../hooks/useCoaching'
import { usePlayerStore } from '../../store/playerStore'
import { useGameStore } from '../../store/gameStore'
import { getLevelInfo, levelProgressPercent, xpToNextLevel } from '../../coaching/levels'
import { getPositionName } from '../../engine/gameFlow'
import type { CoachTip, TipSeverity } from '../../types/coaching'

export function CoachPanel() {
  const tips = useCoaching()
  const { progress } = usePlayerStore()
  const { state } = useGameStore()
  const levelInfo = getLevelInfo(progress.level)
  const progressPct = levelProgressPercent(progress.xp, progress.level)
  const toNext = xpToNextLevel(progress.xp, progress.level)

  const human = state.players[0]
  const position = human ? getPositionName(human.seatIndex, state.dealerSeat, state.players.length) : ''

  return (
    <div className="flex flex-col h-full">
      {/* Header: level & XP */}
      <div className="border-b border-gray-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Coach</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">Level {progress.level}</span>
              <span className="text-sm text-gray-400">{levelInfo.name}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">{progress.xp.toLocaleString()} XP</div>
            {progress.level < 10 && (
              <div className="text-xs text-gray-600">{toNext} to next</div>
            )}
          </div>
        </div>

        {/* XP progress bar */}
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Current game info */}
      {state.street !== 'idle' && state.street !== 'showdown' && (
        <div className="flex gap-4 px-4 py-2 border-b border-gray-800 text-xs text-gray-500">
          <span>Street: <span className="text-gray-300 capitalize">{state.street}</span></span>
          {position && <span>Pos: <span className="text-gray-300">{position}</span></span>}
        </div>
      )}

      {/* Tips — main content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {tips.length === 0 && state.street !== 'idle' && (
          <div className="text-center text-gray-600 text-sm mt-8">
            <div className="text-2xl mb-2">🃏</div>
            <div>Watching the action...</div>
          </div>
        )}

        {state.street === 'idle' && (
          <div className="text-center text-gray-600 text-sm mt-8">
            <div className="text-xl mb-2">Ready to play?</div>
            <div className="text-xs">I'll coach you through every decision.</div>
          </div>
        )}

        {tips.map((tip) => (
          <TipCard key={tip.id} tip={tip} />
        ))}
      </div>

      {/* Stats — buried at the bottom, small and unobtrusive */}
      {progress.handsPlayed > 0 && (
        <div className="border-t border-gray-800 px-4 py-2 flex gap-4 text-xs text-gray-600">
          <span>{progress.handsPlayed} hands</span>
          <span>VPIP {Math.round(progress.vpip * 100)}%</span>
          <span>Win {Math.round((progress.handsWon / progress.handsPlayed) * 100)}%</span>
        </div>
      )}
    </div>
  )
}

function TipCard({ tip }: { tip: CoachTip }) {
  const { border, bg, icon, titleColor } = severityStyles(tip.severity)

  return (
    <div className={`rounded-xl border ${border} ${bg} p-3`}>
      <div className="flex items-start gap-2">
        <span className="text-base">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-semibold ${titleColor} mb-1`}>{tip.title}</div>
          <div className="text-xs text-gray-300 leading-relaxed">{tip.message}</div>
          {tip.xpDelta && (
            <div className={`text-xs mt-1 font-medium ${tip.xpDelta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {tip.xpDelta > 0 ? `+${tip.xpDelta}` : tip.xpDelta} XP
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function severityStyles(severity: TipSeverity) {
  switch (severity) {
    case 'good':
      return { border: 'border-emerald-700', bg: 'bg-emerald-950/50', icon: '✓', titleColor: 'text-emerald-400' }
    case 'info':
      return { border: 'border-blue-800', bg: 'bg-blue-950/40', icon: 'ℹ', titleColor: 'text-blue-400' }
    case 'warning':
      return { border: 'border-yellow-700', bg: 'bg-yellow-950/40', icon: '⚠', titleColor: 'text-yellow-400' }
    case 'mistake':
      return { border: 'border-red-700', bg: 'bg-red-950/40', icon: '✗', titleColor: 'text-red-400' }
  }
}
