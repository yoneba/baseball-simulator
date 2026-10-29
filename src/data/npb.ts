import type { Team } from '../domain/types'
import npb from './npb2026.json'

/** Where the real rosters and stats come from, for display. */
export const NPB_SOURCE = {
  season: npb.season,
  label: `NPB.jp ${npb.season}年度シーズン終了時点の支配下選手と個人成績`,
}

/**
 * The 12 NPB teams with real 2026 rosters. Ratings are derived from 2026
 * regular-season stats by scripts/import-npb.ts, which regenerates the data.
 */
export function npbTeams(): Team[] {
  return structuredClone(npb.teams as unknown as Team[])
}

/** Ids of the fictional teams that versions before the NPB data shipped as defaults. */
export const OLD_FICTIONAL_TEAM_IDS = [
  'tokyo-mirages',
  'yokohama-seagulls',
  'nagoya-blaze',
  'kanazawa-lightning',
  'shizuoka-stellars',
  'okayama-red-owls',
  'hakodate-northerns',
  'niigata-snow-foxes',
  'kyoto-golden-cranes',
  'kobe-comets',
  'kumamoto-volcanoes',
  'okinawa-shisas',
]
