declare module 'phe' {
  export function evaluateCards(cards: string[]): number
  export function evaluateCardsFast(cards: string[]): number
  export function handRank(rank: number): number
  export const rankDescription: string[]
}

declare module 'pokersolver' {
  export class Hand {
    name: string
    descr: string
    static solve(cards: string[]): Hand
    static winners(hands: Hand[]): Hand[]
  }
}
