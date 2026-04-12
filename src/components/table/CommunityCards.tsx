import type { Card } from '../../types/cards'
import { PlayingCard } from '../cards/PlayingCard'

interface CommunityCardsProps {
  cards: Card[]
  pot: number
}

export function CommunityCards({ cards, pot }: CommunityCardsProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Pot display */}
      <div className="text-center">
        <span className="text-sm text-gray-400">Pot: </span>
        <span className="text-lg font-bold text-yellow-300">${pot.toLocaleString()}</span>
      </div>

      {/* Community cards */}
      <div className="flex gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          cards[i] !== undefined ? (
            <PlayingCard key={i} card={cards[i]} />
          ) : (
            <div
              key={i}
              className="w-14 h-20 rounded-lg border border-dashed border-gray-600 opacity-20"
            />
          )
        ))}
      </div>
    </div>
  )
}
