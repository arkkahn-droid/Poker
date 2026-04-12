export type ArchetypeId = 'nit' | 'tag' | 'lag' | 'callingstation' | 'maniac'

export interface ArchetypeConfig {
  id: ArchetypeId
  name: string
  description: string
  vpip: number        // voluntary put in pot %
  pfr: number         // preflop raise %
  af: number          // aggression factor (bet+raise)/(call)
  cbet: number        // continuation bet %
  foldToCbet: number
  bluffFreq: number
  threeBetFreq: number
  foldTo3bet: number
  // Position adjustments: multiplier on open range
  btnMultiplier: number
  coMultiplier: number
  hjMultiplier: number
  // Sizing tendencies
  betSizingMean: number   // fraction of pot (e.g., 0.6 = 60% pot)
  betSizingStd: number    // standard deviation
  timingMeanMs: number    // mean action delay in ms
  timingStdMs: number
}

export interface AIPlayer {
  id: string
  name: string
  archetype: ArchetypeConfig
  seatIndex: number
}

export type AIDecisionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin'

export interface AIDecision {
  action: AIDecisionType
  amount: number
  delayMs: number
}
