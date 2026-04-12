import type { CoachLevel, ConceptId } from '../types/coaching'
import { LEVEL_THRESHOLDS } from '../store/playerStore'

export const COACH_LEVELS: CoachLevel[] = [
  {
    level: 1,
    name: 'Beginner',
    description: 'Learning the basics — hand rankings, blinds, and how the game works.',
    xpRequired: LEVEL_THRESHOLDS[0],
    unlockedConcepts: ['hand-strength', 'position'],
  },
  {
    level: 2,
    name: 'Novice',
    description: 'Understanding position and knowing when to fold weak hands.',
    xpRequired: LEVEL_THRESHOLDS[1],
    unlockedConcepts: ['hand-strength', 'position'],
  },
  {
    level: 3,
    name: 'Developing',
    description: 'Learning pot odds and making better calling decisions.',
    xpRequired: LEVEL_THRESHOLDS[2],
    unlockedConcepts: ['hand-strength', 'position', 'pot-odds'],
  },
  {
    level: 4,
    name: 'Solid',
    description: 'Understanding bet sizing and bluffing basics.',
    xpRequired: LEVEL_THRESHOLDS[3],
    unlockedConcepts: ['hand-strength', 'position', 'pot-odds', 'bet-sizing', 'bluffing'],
  },
  {
    level: 5,
    name: 'Competent',
    description: 'Reading board texture and understanding c-betting.',
    xpRequired: LEVEL_THRESHOLDS[4],
    unlockedConcepts: ['hand-strength', 'position', 'pot-odds', 'bet-sizing', 'bluffing', 'board-texture'],
  },
  {
    level: 6,
    name: 'Skilled',
    description: 'Thinking about hand ranges and exploiting opponent tendencies.',
    xpRequired: LEVEL_THRESHOLDS[5],
    unlockedConcepts: ['hand-strength', 'position', 'pot-odds', 'bet-sizing', 'bluffing', 'board-texture', 'hand-ranges'],
  },
  {
    level: 7,
    name: 'Advanced',
    description: 'Adjusting to opponent archetypes and multi-street planning.',
    xpRequired: LEVEL_THRESHOLDS[6],
    unlockedConcepts: ['hand-strength', 'position', 'pot-odds', 'bet-sizing', 'bluffing', 'board-texture', 'hand-ranges', 'meta-game'],
  },
  {
    level: 8,
    name: 'Expert',
    description: 'GTO fundamentals and exploitative adjustments.',
    xpRequired: LEVEL_THRESHOLDS[7],
    unlockedConcepts: ['hand-strength', 'position', 'pot-odds', 'bet-sizing', 'bluffing', 'board-texture', 'hand-ranges', 'meta-game'],
  },
  {
    level: 9,
    name: 'Elite',
    description: 'Advanced concepts: blockers, range construction, solver thinking.',
    xpRequired: LEVEL_THRESHOLDS[8],
    unlockedConcepts: ['hand-strength', 'position', 'pot-odds', 'bet-sizing', 'bluffing', 'board-texture', 'hand-ranges', 'meta-game'],
  },
  {
    level: 10,
    name: 'Master',
    description: 'Near-optimal play across all game situations.',
    xpRequired: LEVEL_THRESHOLDS[9],
    unlockedConcepts: ['hand-strength', 'position', 'pot-odds', 'bet-sizing', 'bluffing', 'board-texture', 'hand-ranges', 'meta-game'],
  },
]

export function getLevelInfo(level: number): CoachLevel {
  return COACH_LEVELS[Math.min(level, 10) - 1] ?? COACH_LEVELS[0]
}

export function isConceptUnlocked(concept: ConceptId, level: number): boolean {
  const levelInfo = getLevelInfo(level)
  return levelInfo.unlockedConcepts.includes(concept)
}

export function xpToNextLevel(currentXP: number, currentLevel: number): number {
  if (currentLevel >= 10) return 0
  return LEVEL_THRESHOLDS[currentLevel] - currentXP
}

export function levelProgressPercent(currentXP: number, currentLevel: number): number {
  if (currentLevel >= 10) return 100
  const thisLevelXP = LEVEL_THRESHOLDS[currentLevel - 1]
  const nextLevelXP = LEVEL_THRESHOLDS[currentLevel]
  return Math.round(((currentXP - thisLevelXP) / (nextLevelXP - thisLevelXP)) * 100)
}
