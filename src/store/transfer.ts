import { FIELD_POSITIONS, LINEUP_POSITIONS } from '../domain/positions'
import type { Player, Team } from '../domain/types'
import { newId } from './data'

const FORMAT = 'bbsim-teams'
const VERSION = 1

export function exportTeams(teams: Team[]): string {
  return JSON.stringify({ format: FORMAT, version: VERSION, teams }, null, 2)
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
const isRating = (x: unknown) => typeof x === 'number' && x >= 1 && x <= 100
const hasRatings = (x: unknown, keys: string[]) => isObject(x) && keys.every((k) => isRating(x[k]))

function isPlayer(x: unknown): x is Player {
  return (
    isObject(x) &&
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    Number.isInteger(x.number) &&
    ['R', 'L', 'S'].includes(x.bats as string) &&
    ['R', 'L'].includes(x.throws as string) &&
    Array.isArray(x.positions) &&
    x.positions.every((p) => (FIELD_POSITIONS as string[]).includes(p)) &&
    typeof x.foreign === 'boolean' &&
    hasRatings(x.batting, ['contact', 'power', 'eye', 'speed']) &&
    hasRatings(x.fielding, ['range', 'arm', 'hands']) &&
    (x.pitching === undefined || hasRatings(x.pitching, ['stuff', 'control', 'stamina']))
  )
}

function isTeam(x: unknown): x is Team {
  if (!isObject(x) || !isObject(x.lineup)) return false
  const { lineup } = x
  return (
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    typeof x.shortName === 'string' &&
    (x.league === 'central' || x.league === 'pacific') &&
    typeof x.color === 'string' &&
    Array.isArray(x.roster) &&
    x.roster.every(isPlayer) &&
    Array.isArray(lineup.order) &&
    lineup.order.every(
      (s) => isObject(s) && typeof s.playerId === 'string' && (LINEUP_POSITIONS as string[]).includes(s.position as string),
    ) &&
    typeof lineup.startingPitcherId === 'string' &&
    Array.isArray(lineup.bullpen) &&
    Array.isArray(lineup.benchOut)
  )
}

/** Gives a team and its players fresh ids, so an import never overwrites existing data. */
export function withNewIds(team: Team): Team {
  const ids = new Map(team.roster.map((p) => [p.id, newId()]))
  const map = (id: string) => ids.get(id) ?? id
  return {
    ...team,
    id: newId(),
    roster: team.roster.map((p) => ({ ...p, id: map(p.id) })),
    lineup: {
      order: team.lineup.order.map((s) => ({ ...s, playerId: map(s.playerId) })),
      startingPitcherId: map(team.lineup.startingPitcherId),
      bullpen: team.lineup.bullpen.map(map),
      benchOut: team.lineup.benchOut.map(map),
    },
  }
}

/** Parses an exported file. Throws an Error with a Japanese message when it is invalid. */
export function parseTeamsFile(text: string): Team[] {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('JSONとして読み込めませんでした。')
  }
  if (!isObject(raw) || raw.format !== FORMAT) throw new Error('このアプリから書き出したファイルではありません。')
  if (raw.version !== VERSION) throw new Error('対応していないバージョンのファイルです。')
  if (!Array.isArray(raw.teams) || raw.teams.length === 0) throw new Error('チームが含まれていません。')
  const bad = raw.teams.findIndex((t) => !isTeam(t))
  if (bad >= 0) throw new Error(`${bad + 1}番目のチームのデータが壊れています。`)
  return (raw.teams as Team[]).map(withNewIds)
}
