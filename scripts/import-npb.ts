/**
 * Builds src/data/npb2026.json: the 12 NPB teams with their real 支配下
 * rosters and ratings derived from 2026 regular-season stats on NPB.jp.
 *
 * Usage: bun scripts/import-npb.ts [--refresh]
 *
 * Pages are cached in node_modules/.cache/npb; --refresh downloads them again.
 */
import { mkdir } from 'node:fs/promises'
import { autoLineup } from '../src/domain/autoLineup'
import { DEFAULT_LEAGUE_RULES } from '../src/domain/rules'
import type { FieldPosition, League, Player, Team } from '../src/domain/types'
import { validateLineup, validateRoster } from '../src/domain/validate'
import { looksForeign, nameKey, parseFielding, parseRoster, parseStats, type RosterEntry } from './npb/parse'
import {
  battingNorms,
  battingRates,
  battingScores,
  fieldingLine,
  fieldingNorms,
  fieldingRatings,
  pitchingNorms,
  pitchingRates,
  pitchingScores,
  scaleRatings,
  stamina,
  type BattingRates,
  type FieldingLine,
  type PitchingRates,
} from './npb/ratings'

const SEASON = 2026
const CACHE = 'node_modules/.cache/npb'
const OUTPUT = 'src/data/npb2026.json'
const refresh = process.argv.includes('--refresh')

interface TeamMeta {
  code: string
  shortName: string
  league: League
  color: string
}

const TEAMS: TeamMeta[] = [
  { code: 'g', shortName: '巨人', league: 'central', color: '#f97709' },
  { code: 't', shortName: '阪神', league: 'central', color: '#e8b500' },
  { code: 'db', shortName: 'DeNA', league: 'central', color: '#0055a5' },
  { code: 'c', shortName: '広島', league: 'central', color: '#e60012' },
  { code: 's', shortName: 'ヤクルト', league: 'central', color: '#1d7a46' },
  { code: 'd', shortName: '中日', league: 'central', color: '#003c8f' },
  { code: 'h', shortName: 'ソフトバンク', league: 'pacific', color: '#c79a00' },
  { code: 'f', shortName: '日本ハム', league: 'pacific', color: '#006298' },
  { code: 'm', shortName: 'ロッテ', league: 'pacific', color: '#333333' },
  { code: 'e', shortName: '楽天', league: 'pacific', color: '#860010' },
  { code: 'b', shortName: 'オリックス', league: 'pacific', color: '#b08d2e' },
  { code: 'l', shortName: '西武', league: 'pacific', color: '#102961' },
]

const SECTION_POSITIONS: Record<string, FieldPosition[]> = {
  一塁手: ['1B'],
  二塁手: ['2B'],
  三塁手: ['3B'],
  遊撃手: ['SS'],
  外野手: ['LF', 'CF', 'RF'],
  捕手: ['C'],
}

async function page(path: string): Promise<string> {
  const file = `${CACHE}/${path.replaceAll('/', '_')}`
  const cached = Bun.file(file)
  if (!refresh && (await cached.exists())) return cached.text()
  const res = await fetch(`https://npb.jp/bis/${path}`, { headers: { 'User-Agent': 'baseball-simulator data import' } })
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  const html = await res.text()
  await Bun.write(file, html)
  // Be polite to NPB.jp.
  await new Promise((r) => setTimeout(r, 1000))
  return html
}

interface Candidate {
  team: TeamMeta
  entry: RosterEntry
  foreign: boolean
  batting: BattingRates
  pitching: PitchingRates | null
  fielding: FieldingLine[]
}

await mkdir(CACHE, { recursive: true })
const loaded: { meta: TeamMeta; teamName: string; candidates: Candidate[] }[] = []
for (const meta of TEAMS) {
  const roster = parseRoster(await page(`teams/rst_${meta.code}.html`))
  const batting = parseStats(await page(`${SEASON}/stats/idb1_${meta.code}.html`))
  const pitching = parseStats(await page(`${SEASON}/stats/idp1_${meta.code}.html`))
  const fielding = parseFielding(await page(`${SEASON}/stats/idf1_${meta.code}.html`))
  const candidates = roster.players.map((entry): Candidate => {
    const key = nameKey(entry.name)
    const lines = [...fielding].flatMap(([section, rows]) =>
      rows.filter((r) => nameKey(r['選手']) === key).map((r) => fieldingLine(section, r)),
    )
    return {
      team: meta,
      entry,
      foreign: looksForeign(entry.name),
      batting: battingRates(batting.get(key)),
      pitching: entry.group === '投手' ? pitchingRates(pitching.get(key)) : null,
      fielding: lines,
    }
  })
  loaded.push({ meta, teamName: roster.teamName, candidates })
  console.log(`${roster.teamName}: 支配下${roster.players.length}人`)
}

const everyone = loaded.flatMap((t) => t.candidates)
const bNorms = battingNorms(everyone.filter((c) => !c.pitching).map((c) => c.batting))
const pNorms = pitchingNorms(everyone.flatMap((c) => (c.pitching ? [c.pitching] : [])))
const fNorms = fieldingNorms(everyone.flatMap((c) => c.fielding))

const PITCHER_BATTING = { contact: 15, power: 10, eye: 15, speed: 30 }

// Batting and pitching ratings, scaled against regulars across the league.
const batters = everyone.filter((c) => !c.pitching)
const battingScaled = new Map(
  zip(batters, scaleRatings(batters.map((c) => battingScores(c.batting, bNorms)), batters.filter((c) => c.batting.pa >= 300).map((c) => battingScores(c.batting, bNorms)))),
)
const pitchers = everyone.filter((c) => c.pitching)
const pitchingScaled = new Map(
  zip(pitchers, scaleRatings(pitchers.map((c) => pitchingScores(c.pitching!, pNorms)), pitchers.filter((c) => c.pitching!.bf >= 100).map((c) => pitchingScores(c.pitching!, pNorms)))),
)

function zip<A, B>(a: A[], b: B[]): [A, B][] {
  return a.map((x, i) => [x, b[i]])
}

function positionsOf(c: Candidate): FieldPosition[] {
  if (c.pitching) return ['P']
  const played = c.fielding
    .filter((l) => l.games >= 3 && l.section in SECTION_POSITIONS)
    .sort((a, b) => b.games - a.games)
    .flatMap((l) => SECTION_POSITIONS[l.section])
  if (played.length > 0) return [...new Set(played)]
  if (c.entry.group === '捕手') return ['C']
  return c.entry.group === '外野手' ? ['LF', 'RF'] : ['1B', '3B']
}

function toPlayer(c: Candidate): Player {
  return {
    id: `npb-${c.team.code}-${c.entry.number}`,
    name: c.entry.name,
    number: c.entry.number,
    bats: c.entry.bats,
    throws: c.entry.throws,
    positions: positionsOf(c),
    foreign: c.foreign,
    batting: c.pitching ? PITCHER_BATTING : battingScaled.get(c)!,
    fielding: fieldingRatings(c.fielding, fNorms),
    ...(c.pitching ? { pitching: { ...pitchingScaled.get(c)!, stamina: stamina(c.pitching) } } : {}),
  }
}

const gamesAt = (c: Candidate, section: string) => c.fielding.find((l) => l.section === section)?.games ?? 0

/** Picks a 31-man 一軍 (15 pitchers, 16 fielders) by 2026 playing time, within the 外国人枠. */
function pickActive(candidates: Candidate[]): Candidate[] {
  const rules = DEFAULT_LEAGUE_RULES.central
  const picked: Candidate[] = []
  const foreign = (pitcher: boolean) => picked.filter((c) => c.foreign && !!c.pitching === pitcher).length
  const allowed = (c: Candidate) =>
    !picked.includes(c) &&
    (!c.foreign ||
      (picked.filter((p) => p.foreign).length < rules.foreignLimit && foreign(!!c.pitching) < rules.foreignPerRoleLimit))
  const take = (pool: Candidate[], count: number, score: (c: Candidate) => number) => {
    for (const c of [...pool].sort((a, b) => score(b) - score(a))) {
      if (count <= 0) break
      if (allowed(c)) {
        picked.push(c)
        count--
      }
    }
  }

  const pitchers = candidates.filter((c) => c.pitching)
  const starters = pitchers.filter((c) => c.pitching!.games > 0 && c.pitching!.outs / 3 / c.pitching!.games >= 3)
  take(starters, 6, (c) => c.pitching!.outs)
  take(pitchers, 15 - picked.length, (c) => c.pitching!.games * 1000 + c.pitching!.bf)

  const fielders = candidates.filter((c) => !c.pitching)
  // The regular at each position first, so every position is covered.
  for (const [section, count] of [['捕手', 2], ['遊撃手', 1], ['二塁手', 1], ['三塁手', 1], ['一塁手', 1], ['外野手', 3]] as const) {
    take(fielders.filter((c) => gamesAt(c, section) > 0), count, (c) => gamesAt(c, section))
  }
  take(fielders.filter((c) => gamesAt(c, '捕手') > 0 || c.entry.group === '捕手'), 3 - picked.filter((c) => positionsOf(c).includes('C')).length, (c) => gamesAt(c, '捕手'))
  take(fielders, 31 - picked.length, (c) => c.batting.pa)
  return picked
}

/**
 * NPB.jp lists outfielders together, so CF eligibility is inferred: outfielders
 * with above-average range, and at least the team's best-ranging outfielder.
 */
function limitCenterField(roster: Player[]): Player[] {
  const outfielders = roster.filter((p) => p.positions.includes('CF'))
  const best = outfielders.reduce<Player | null>((a, b) => (!a || b.fielding.range > a.fielding.range ? b : a), null)
  return roster.map((p) =>
    p.positions.includes('CF') && p !== best && p.fielding.range < 50
      ? { ...p, positions: p.positions.filter((pos) => pos !== 'CF') }
      : p,
  )
}

const teams: Team[] = []
for (const { meta, teamName, candidates } of loaded) {
  const roster = limitCenterField(pickActive(candidates).map(toPlayer))
  const team: Team = {
    id: `npb-${meta.code}`,
    name: teamName,
    shortName: meta.shortName,
    league: meta.league,
    color: meta.color,
    roster,
    lineup: autoLineup({ roster }),
  }
  const rules = DEFAULT_LEAGUE_RULES[meta.league]
  const errors = [...validateRoster(team, rules), ...validateLineup(team, rules)]
  if (errors.length > 0) console.warn(`${teamName}:`, errors)
  teams.push(team)
}

await Bun.write(OUTPUT, JSON.stringify({ season: SEASON, source: 'NPB.jp', teams }, null, 1) + '\n')
console.log(`${OUTPUT} に${teams.length}球団を書き出しました。`)
