import { useEffect } from 'react'
import { useGameStore } from './store/gameStore'
import { usePlayerStore } from './store/playerStore'
import { loadProfile } from './db/playerProfile'
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

  if (state.phase === 'lobby') return <Lobby />
  if (state.phase === 'game') return <PokerTable />

  return <Lobby />
}

export default App
