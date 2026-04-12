import type { GameState, ActionType } from '../types/game'

export interface HandXPResult {
  xpDelta: number
  reasons: string[]
}

// Award XP based on what happened this hand
export function calculateHandXP(
  _state: GameState,
  playerWon: boolean,
  actions: { action: ActionType; equity: number }[],
  playerLevel: number,
): HandXPResult {
  let xp = 5 // base XP for playing a hand
  const reasons: string[] = []

  if (playerWon) {
    xp += 5
    reasons.push('+5 XP: Won the hand')
  }

  // Evaluate decisions
  for (const { action, equity } of actions) {
    if (action === 'fold' && equity < 0.25) {
      xp += 5
      reasons.push('+5 XP: Correct fold (low equity)')
    }

    if (action === 'call' && equity < 0.20) {
      xp -= 5
      reasons.push('-5 XP: Called with insufficient equity')
    }

    if (action === 'fold' && equity > 0.60) {
      xp -= 3
      reasons.push('-3 XP: Folded with strong equity')
    }
  }

  // Level bonus for play quality (advanced players get more per good decision)
  if (playerLevel >= 5) xp = Math.round(xp * 1.2)

  return { xpDelta: Math.max(-15, Math.min(30, xp)), reasons }
}
