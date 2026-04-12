import Dexie, { type Table } from 'dexie'
import type { PlayerProfileRecord, SessionRecord, HandRecord } from '../types/db'

class PokerDB extends Dexie {
  profile!: Table<PlayerProfileRecord>
  sessions!: Table<SessionRecord>
  hands!: Table<HandRecord>

  constructor() {
    super('PokerCoachDB')

    this.version(1).stores({
      profile: 'id',
      sessions: '++id, startedAt, gameMode',
      hands: '++id, sessionId, handNumber, playedAt, vpip, pfr, wentToShowdown',
    })
  }
}

export const db = new PokerDB()
