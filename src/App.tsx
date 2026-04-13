import { useEffect } from 'react'
import { useGameStore } from './store/gameStore'
import { usePlayerStore } from './store/playerStore'
import { loadProfile, saveProfile } from './db/playerProfile'
import { Lobby } from './components/lobby/Lobby'
import { PokerTable } from './components/table/PokerTable'

function App() {
  const { state } = useGameStore()
  const { loadFromDB } = usePlayerStore()

  // Load player profile from IndexedDB on mount
  useEffect(() => {
    loadProfile().then((profile) => {
      loadFromDB({
        username: profile.username,
        bankroll: profile.bankroll,
        progress: {
          level: profile.level,
          xp: profile.xp,
          handsPlayed: profile.handsPlayed,
          handsWon: profile.handsWon,
          correctFolds: profile.correctFolds,
          incorrectCalls: profile.incorrectCalls,
          missedValueBets: profile.missedValueBets,
          successfulBluffs: profile.successfulBluffs,
          badBluffs: profile.badBluffs,
          vpip: profile.vpip,
          pfr: profile.pfr,
          bb100: profile.bb100,
        },
      })
    })
  }, [])

  // Auto-save profile to IndexedDB whenever progress changes (debounced 500ms)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsub = usePlayerStore.subscribe((s) => {
      if (!s.loaded) return  // don't save before initial load completes
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        saveProfile({
          level: s.progress.level,
          xp: s.progress.xp,
          bankroll: s.bankroll,
          handsPlayed: s.progress.handsPlayed,
          handsWon: s.progress.handsWon,
          vpip: s.progress.vpip,
          pfr: s.progress.pfr,
          bb100: s.progress.bb100,
          correctFolds: s.progress.correctFolds,
          incorrectCalls: s.progress.incorrectCalls,
          missedValueBets: s.progress.missedValueBets,
          successfulBluffs: s.progress.successfulBluffs,
          badBluffs: s.progress.badBluffs,
        })
      }, 500)
    })
    return () => {
      unsub()
      if (timer) clearTimeout(timer)
    }
  }, [])

  if (state.phase === 'lobby') return <Lobby />
  if (state.phase === 'game') return <PokerTable />

  return <Lobby />
}

export default App
