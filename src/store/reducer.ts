import type { League, LeagueRules, Team } from '../domain/types'
import { defaultData, MAX_SAVED_GAMES, type AppData, type SavedGame } from './data'

export type StoreAction =
  | { type: 'upsertTeam'; team: Team }
  | { type: 'deleteTeam'; teamId: string }
  | { type: 'importTeams'; teams: Team[] }
  | { type: 'setLeagueRules'; league: League; rules: LeagueRules }
  | { type: 'addSavedGame'; game: SavedGame }
  | { type: 'deleteSavedGame'; gameId: string }
  | { type: 'reset' }

export function storeReducer(state: AppData, action: StoreAction): AppData {
  switch (action.type) {
    case 'upsertTeam': {
      const exists = state.teams.some((t) => t.id === action.team.id)
      const teams = exists
        ? state.teams.map((t) => (t.id === action.team.id ? action.team : t))
        : [...state.teams, action.team]
      return { ...state, teams }
    }
    case 'deleteTeam':
      return { ...state, teams: state.teams.filter((t) => t.id !== action.teamId) }
    case 'importTeams':
      return { ...state, teams: [...state.teams, ...action.teams] }
    case 'setLeagueRules':
      return { ...state, leagueRules: { ...state.leagueRules, [action.league]: action.rules } }
    case 'addSavedGame':
      return { ...state, savedGames: [action.game, ...state.savedGames].slice(0, MAX_SAVED_GAMES) }
    case 'deleteSavedGame':
      return { ...state, savedGames: state.savedGames.filter((g) => g.id !== action.gameId) }
    case 'reset':
      return defaultData()
  }
}
