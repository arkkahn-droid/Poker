import { db } from './schema'
import type { PlayerProfileRecord } from '../types/db'

const DEFAULT_PROFILE: PlayerProfileRecord = {
  id: 1,
  username: 'Player',
  level: 1,
  xp: 0,
  bankroll: 5000,
  handsPlayed: 0,
  handsWon: 0,
  vpip: 0,
  pfr: 0,
  bb100: 0,
  correctFolds: 0,
  incorrectCalls: 0,
  missedValueBets: 0,
  successfulBluffs: 0,
  badBluffs: 0,
  createdAt: Date.now(),
  lastPlayedAt: Date.now(),
}

export async function loadProfile(): Promise<PlayerProfileRecord> {
  try {
    const existing = await db.profile.get(1)
    return existing ?? DEFAULT_PROFILE
  } catch {
    return DEFAULT_PROFILE
  }
}

export async function saveProfile(updates: Partial<PlayerProfileRecord>): Promise<void> {
  try {
    const existing = await db.profile.get(1)
    if (existing) {
      await db.profile.update(1, { ...updates, lastPlayedAt: Date.now() })
    } else {
      await db.profile.put({ ...DEFAULT_PROFILE, ...updates, lastPlayedAt: Date.now() })
    }
  } catch {
    // IndexedDB unavailable — fail silently
  }
}
