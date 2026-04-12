import { getCardDisplay } from '../../engine/cards'
import type { Card } from '../../types/cards'

interface PlayingCardProps {
  card: Card
  faceDown?: boolean
  small?: boolean
  className?: string
}

export function PlayingCard({ card, faceDown = false, small = false, className = '' }: PlayingCardProps) {
  const size = small ? 'w-9 h-13 text-xs' : 'w-14 h-20 text-base'

  if (faceDown) {
    return (
      <div
        className={`${size} rounded-lg border border-gray-600 bg-gradient-to-br from-blue-900 to-blue-800 flex items-center justify-center shadow-md ${className}`}
      >
        <div className="w-3/4 h-3/4 border border-blue-600 rounded opacity-40" />
      </div>
    )
  }

  const display = getCardDisplay(card)

  return (
    <div
      className={`${size} rounded-lg border border-gray-300 bg-white shadow-md flex flex-col justify-between p-1 select-none ${className}`}
    >
      <div className="leading-none font-bold" style={{ color: display.color, fontSize: small ? '0.7rem' : '0.9rem' }}>
        <div>{display.rank}</div>
        <div>{display.suit}</div>
      </div>
      <div className="self-center font-bold text-lg" style={{ color: display.color }}>
        {display.suit}
      </div>
      <div className="self-end leading-none font-bold rotate-180" style={{ color: display.color, fontSize: small ? '0.7rem' : '0.9rem' }}>
        <div>{display.rank}</div>
        <div>{display.suit}</div>
      </div>
    </div>
  )
}

interface HoleCardsProps {
  cards: Card[]
  faceDown?: boolean
  small?: boolean
  className?: string
}

export function HoleCards({ cards, faceDown = false, small = false, className = '' }: HoleCardsProps) {
  if (cards.length === 0) {
    return (
      <div className={`flex gap-1 ${className}`}>
        <PlayingCard card={0} faceDown small={small} />
        <PlayingCard card={1} faceDown small={small} />
      </div>
    )
  }

  return (
    <div className={`flex gap-1 ${className}`}>
      {cards.map((card, i) => (
        <PlayingCard key={i} card={card} faceDown={faceDown} small={small} />
      ))}
    </div>
  )
}
