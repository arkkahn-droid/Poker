import type { PlayerState } from '../../types/game'
import { HoleCards } from '../cards/PlayingCard'
import { getPositionName } from '../../engine/gameFlow'

interface PlayerSeatProps {
  player: PlayerState
  dealerSeat: number
  totalPlayers: number
  isActing: boolean
  showCards: boolean
  compact?: boolean
  className?: string
}

export function PlayerSeat({
  player,
  dealerSeat,
  totalPlayers,
  isActing,
  showCards,
  compact = false,
  className = '',
}: PlayerSeatProps) {
  const position = getPositionName(player.seatIndex, dealerSeat, totalPlayers)
  const isHuman = player.isHuman

  const statusColor = player.folded
    ? 'text-gray-500'
    : isActing
    ? 'text-yellow-400'
    : 'text-gray-200'

  const borderColor = player.folded
    ? 'border-gray-700'
    : isActing
    ? 'border-yellow-400 shadow-yellow-400/30 shadow-lg'
    : isHuman
    ? 'border-blue-500'
    : 'border-gray-600'

  const bgColor = player.folded
    ? 'bg-gray-800/40'
    : isHuman
    ? 'bg-blue-950/60'
    : 'bg-gray-800/60'

  const lastActionLabel = player.lastAction
    ? formatAction(player.lastAction.action, player.lastAction.amount)
    : null

  if (compact) {
    // Compact layout for AI seats: smaller box, no last-action clutter
    return (
      <div className={`${className} flex flex-col items-center gap-0.5`}>
        <HoleCards cards={player.holeCards} faceDown={!showCards} small />
        <div
          className={`rounded border px-1.5 py-0.5 min-w-[70px] text-center ${bgColor} ${borderColor} transition-all`}
        >
          <div className={`text-[10px] font-semibold truncate ${statusColor}`}>{player.name}</div>
          <div className="text-[9px] text-gray-500">{position}</div>
          <div className={`text-[10px] font-bold ${player.isAllIn ? 'text-red-400' : 'text-white'}`}>
            {player.isAllIn ? 'ALL-IN' : `$${player.stack.toLocaleString()}`}
          </div>
          {player.bet > 0 && (
            <div className="text-[9px] text-yellow-300">Bet ${player.bet}</div>
          )}
        </div>
        {player.seatIndex === dealerSeat && (
          <div className="text-[9px] bg-yellow-500 text-black rounded-full px-1.5 py-px font-bold">D</div>
        )}
      </div>
    )
  }

  return (
    <div className={`${className} flex flex-col items-center gap-1`}>
      {/* Cards */}
      <HoleCards
        cards={player.holeCards}
        faceDown={!isHuman && !showCards}
        small
      />

      {/* Player info box */}
      <div
        className={`rounded-lg border px-3 py-1.5 min-w-[110px] text-center ${bgColor} ${borderColor} transition-all`}
      >
        <div className={`text-xs font-semibold truncate ${statusColor}`}>
          {player.name}
          {isHuman && <span className="ml-1 text-blue-400">(You)</span>}
        </div>
        <div className="text-xs text-gray-400">{position}</div>
        <div className={`text-sm font-bold ${player.isAllIn ? 'text-red-400' : 'text-white'}`}>
          {player.isAllIn ? 'ALL-IN' : `$${player.stack.toLocaleString()}`}
        </div>
        {player.bet > 0 && (
          <div className="text-xs text-yellow-300">Bet: ${player.bet}</div>
        )}
        {lastActionLabel && (
          <div className="text-xs text-emerald-400 mt-0.5">{lastActionLabel}</div>
        )}
      </div>

      {/* Dealer button */}
      {player.seatIndex === dealerSeat && (
        <div className="text-xs bg-yellow-500 text-black rounded-full px-2 py-0.5 font-bold">
          D
        </div>
      )}
    </div>
  )
}

function formatAction(action: string, amount: number): string {
  switch (action) {
    case 'fold': return 'Folded'
    case 'check': return 'Checked'
    case 'call': return `Called $${amount}`
    case 'bet': return `Bet $${amount}`
    case 'raise': return `Raised $${amount}`
    case 'allin': return 'All-In!'
    default: return ''
  }
}
