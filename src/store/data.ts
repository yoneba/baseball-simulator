import { generateDefaultTeams } from '../data/generate'
import { DEFAULT_LEAGUE_RULES } from '../domain/rules'
import type { League, LeagueRules, Team } from '../domain/types'
import type { GameSetup, RecordedAction, Side } from '../sim/game'

export const STORAGE_KEY = 'bbsim:v1'
export const SCHEMA_VERSION = 2
/** Oldest saved games are dropped past this, to stay well inside localStorage quotas. */
export const MAX_SAVED_GAMES = 100

export interface SavedGameSummary {
  score: Record<Side, number>
  result: Side | 'tie'
  innings: number
}

export interface SavedGame {
  id: string
  playedAt: string
  setup: GameSetup
  actions: RecordedAction[]
  summary: SavedGameSummary
}

export interface AppData {
  schemaVersion: number
  teams: Team[]
  leagueRules: Record<League, LeagueRules>
  savedGames: SavedGame[]
}

export function defaultData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    teams: generateDefaultTeams(),
    leagueRules: structuredClone(DEFAULT_LEAGUE_RULES),
    savedGames: [],
  }
}

/** Version 1 stored 背番号 as numbers; they are strings from version 2. */
export function stringifyNumbers(teams: Team[]): Team[] {
  return teams.map((t) => ({ ...t, roster: t.roster.map((p) => ({ ...p, number: String(p.number) })) }))
}

/** Upgrades stored data from older schema versions. */
function migrate(raw: { schemaVersion?: number } & Partial<AppData>): AppData {
  let teams = raw.teams ?? []
  let savedGames = raw.savedGames ?? []
  if ((raw.schemaVersion ?? 1) < 2) {
    teams = stringifyNumbers(teams)
    savedGames = savedGames.map((g) => {
      const [away, home] = stringifyNumbers([g.setup.away, g.setup.home])
      return { ...g, setup: { ...g.setup, away, home } }
    })
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    teams,
    leagueRules: { ...structuredClone(DEFAULT_LEAGUE_RULES), ...raw.leagueRules },
    savedGames,
  }
}

/** localStorage, or null when it is unavailable (private mode, blocked site data). */
export function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Loads saved data. The first visit, or unreadable data, starts from the default league. */
export function loadData(storage: Storage | null = safeStorage()): AppData {
  try {
    const text = storage?.getItem(STORAGE_KEY)
    if (!text) return defaultData()
    const raw = JSON.parse(text)
    if (typeof raw !== 'object' || raw === null) return defaultData()
    return migrate(raw)
  } catch {
    return defaultData()
  }
}

/** Saves data. Returns false when storage is unavailable or full. */
export function saveData(data: AppData, storage: Storage | null = safeStorage()): boolean {
  try {
    if (!storage) return false
    storage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function newId(): string {
  return crypto.randomUUID()
}
