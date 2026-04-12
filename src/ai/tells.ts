import type { ArchetypeConfig } from '../types/ai'

// Box-Muller transform for Gaussian random numbers
export function gaussianRandom(mean: number, std: number): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  return mean + z * std
}

// Get action delay with human-like variance
export function getTimingDelay(archetype: ArchetypeConfig): number {
  const raw = gaussianRandom(archetype.timingMeanMs, archetype.timingStdMs)
  return Math.max(300, Math.min(6000, raw))
}

// Get bet sizing as chip amount
export function getBetSizing(
  archetype: ArchetypeConfig,
  pot: number,
  fractionOverride?: number,
): number {
  const fraction = fractionOverride ??
    gaussianRandom(archetype.betSizingMean, archetype.betSizingStd)

  const clamped = Math.max(0.25, Math.min(2.5, fraction))
  return Math.max(1, Math.round(pot * clamped))
}

// Occasionally make human-like "mistakes"
export function shouldMakeMistake(archetype: ArchetypeConfig): boolean {
  // Fish and calling stations make more mistakes
  const mistakeRate: Record<string, number> = {
    nit: 0.03,
    tag: 0.02,
    lag: 0.05,
    callingstation: 0.10,
    maniac: 0.08,
  }
  return Math.random() < (mistakeRate[archetype.id] ?? 0.03)
}
