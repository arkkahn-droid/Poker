import { db } from './schema'
import type { HandRecord } from '../types/db'

export async function saveHand(hand: Omit<HandRecord, 'id'>): Promise<void> {
  try {
    await db.hands.add(hand)
  } catch {
    // fail silently if IndexedDB unavailable
  }
}

export async function getRecentHands(limit = 20): Promise<HandRecord[]> {
  try {
    return await db.hands.orderBy('playedAt').reverse().limit(limit).toArray()
  } catch {
    return []
  }
}

export async function getSessionHands(sessionId: number): Promise<HandRecord[]> {
  try {
    return await db.hands.where('sessionId').equals(sessionId).toArray()
  } catch {
    return []
  }
}

export async function getTotalHandCount(): Promise<number> {
  try {
    return await db.hands.count()
  } catch {
    return 0
  }
}
