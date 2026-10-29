/**
 * Turns real season stats into 1–100 ratings (50 = league average).
 *
 * Each rate is regressed toward the league mean by sample size, then
 * converted to a z-score against regulars, so part-timers do not get
 * extreme ratings from a handful of plate appearances.
 */
import type { BattingRatings, FieldingRatings } from '../../src/domain/types'
import { inningsToOuts, type StatRow } from './parse'

const num = (row: StatRow | undefined, key: string) => Number(row?.[key] ?? 0) || 0

export interface Distribution {
  mean: number
  sd: number
}

export function distribution(values: number[], weights: number[] = values.map(() => 1)): Distribution {
  const total = weights.reduce((a, b) => a + b, 0)
  const mean = values.reduce((s, v, i) => s + v * weights[i], 0) / total
  const variance = values.reduce((s, v, i) => s + (v - mean) ** 2 * weights[i], 0) / total
  return { mean, sd: Math.sqrt(variance) || 1 }
}

/** Shrinks an observed rate toward the mean: `k` is the sample size that counts as half the evidence. */
export function regress(rate: number, n: number, mean: number, k: number): number {
  return (rate * n + mean * k) / (n + k)
}

export function toRating(z: number): number {
  return Math.round(Math.min(99, Math.max(1, 50 + z * 15)))
}

const z = (value: number, d: Distribution) => (value - d.mean) / d.sd

// ── Batting ────────────────────────────────────────────────────────────

export interface BattingRates {
  pa: number
  k: number
  bb: number
  avg: number
  iso: number
  hr: number
  spd: number
}

export function battingRates(row: StatRow | undefined): BattingRates {
  const pa = num(row, '打席')
  const ab = num(row, '打数')
  const h = num(row, '安打')
  const safe = (x: number, d: number) => (d > 0 ? x / d : 0)
  return {
    pa,
    k: safe(num(row, '三振'), pa),
    bb: safe(num(row, '四球') - num(row, '故意四') + num(row, '死球'), pa),
    avg: safe(h, ab),
    iso: safe(num(row, '塁打') - h, ab),
    hr: safe(num(row, '本塁打'), pa),
    spd: safe(num(row, '盗塁') + 0.5 * num(row, '盗塁刺') + 2 * num(row, '三塁打'), pa),
  }
}

export type BattingNorms = Record<Exclude<keyof BattingRates, 'pa'>, Distribution>

/** League norms from regulars (300+ plate appearances). */
export function battingNorms(all: BattingRates[]): BattingNorms {
  const regulars = all.filter((r) => r.pa >= 300)
  const keys = ['k', 'bb', 'avg', 'iso', 'hr', 'spd'] as const
  return Object.fromEntries(keys.map((key) => [key, distribution(regulars.map((r) => r[key]))])) as BattingNorms
}

/** Bench players regress toward a slightly below-average prior. */
const BATTING_K = 200
const BENCH_PENALTY = 0.5

/** Ratings before scaling, in z units. Combined scores are re-standardized by `scaleRatings`. */
export function battingScores(r: BattingRates, norms: BattingNorms): BattingRatings {
  const reg = (key: keyof BattingNorms, betterHigh: boolean) => {
    const prior = norms[key].mean + (betterHigh ? -1 : 1) * BENCH_PENALTY * norms[key].sd
    return z(regress(r[key], r.pa, prior, BATTING_K), norms[key])
  }
  return {
    contact: 0.55 * reg('avg', true) - 0.45 * reg('k', false),
    power: 0.6 * reg('iso', true) + 0.4 * reg('hr', true),
    eye: reg('bb', true),
    speed: reg('spd', true),
  }
}

/**
 * Converts scores to ratings so that regulars spread like single stats do:
 * a blend of two z-scores has a smaller spread than either one.
 */
export function scaleRatings<T extends { [K in keyof T]: number }>(scores: T[], regulars: T[]): T[] {
  const keys = Object.keys(regulars[0] ?? {}) as (keyof T)[]
  const norms = new Map(keys.map((k) => [k, distribution(regulars.map((s) => s[k]))]))
  return scores.map(
    (s) => Object.fromEntries(keys.map((k) => [k, toRating(z(s[k], norms.get(k)!))])) as T,
  )
}

// ── Pitching ───────────────────────────────────────────────────────────

export interface PitchingRates {
  bf: number
  outs: number
  games: number
  k: number
  bb: number
  hr: number
}

export function pitchingRates(row: StatRow | undefined): PitchingRates {
  const bf = num(row, '打者')
  const safe = (x: number) => (bf > 0 ? x / bf : 0)
  return {
    bf,
    outs: inningsToOuts(row?.['投球回'] ?? '0'),
    games: num(row, '登板'),
    k: safe(num(row, '三振')),
    bb: safe(num(row, '四球') - num(row, '故意四') + num(row, '死球')),
    hr: safe(num(row, '本塁打')),
  }
}

export type PitchingNorms = Record<'k' | 'bb' | 'hr', Distribution>

/** League norms weighted by batters faced, from pitchers with 100+ batters faced. */
export function pitchingNorms(all: PitchingRates[]): PitchingNorms {
  const regulars = all.filter((r) => r.bf >= 100)
  const keys = ['k', 'bb', 'hr'] as const
  return Object.fromEntries(
    keys.map((key) => [key, distribution(regulars.map((r) => r[key]), regulars.map((r) => r.bf))]),
  ) as PitchingNorms
}

const PITCHING_K = 150

/** Stuff and control before scaling, in z units. */
export function pitchingScores(r: PitchingRates, norms: PitchingNorms): { stuff: number; control: number } {
  const reg = (key: keyof PitchingNorms) => z(regress(r[key], r.bf, norms[key].mean, PITCHING_K), norms[key])
  return { stuff: 0.75 * reg('k') - 0.25 * reg('hr'), control: -reg('bb') }
}

/** Innings per appearance (about 1 for relievers, 6 for starters) as スタミナ. */
export function stamina(r: PitchingRates): number {
  const ipPerGame = r.games > 0 ? r.outs / 3 / r.games : 1
  return Math.round(Math.min(95, Math.max(10, 15 + ipPerGame * 12)))
}

// ── Fielding ───────────────────────────────────────────────────────────

export interface FieldingLine {
  /** NPB.jp section: 一塁手, 二塁手, 三塁手, 遊撃手, 外野手, 捕手. */
  section: string
  games: number
  /** (刺殺 + 補殺) per game. */
  rangeFactor: number
  /** 補殺 per game: throwing chances for outfielders and catchers. */
  assists: number
  pct: number
}

export function fieldingLine(section: string, row: StatRow): FieldingLine {
  const games = num(row, '試合')
  const po = num(row, '刺殺')
  const a = num(row, '補殺')
  const e = num(row, '失策')
  return {
    section,
    games,
    rangeFactor: games > 0 ? (po + a) / games : 0,
    assists: games > 0 ? a / games : 0,
    pct: po + a + e > 0 ? (po + a) / (po + a + e) : 1,
  }
}

export type FieldingNorms = Map<string, Record<'rangeFactor' | 'assists' | 'pct', Distribution>>

/** Per-position norms from players with 30+ games there. */
export function fieldingNorms(all: FieldingLine[]): FieldingNorms {
  const norms: FieldingNorms = new Map()
  for (const section of new Set(all.map((l) => l.section))) {
    const regulars = all.filter((l) => l.section === section && l.games >= 30)
    if (regulars.length < 3) continue
    norms.set(section, {
      rangeFactor: distribution(regulars.map((l) => l.rangeFactor)),
      assists: distribution(regulars.map((l) => l.assists)),
      pct: distribution(regulars.map((l) => l.pct)),
    })
  }
  return norms
}

const FIELDING_K = 40
const DEFAULT_FIELDING: FieldingRatings = { range: 45, arm: 50, hands: 50 }

/** Combines a player's positions, weighted by games. Players with no fielding record get slightly below average. */
export function fieldingRatings(lines: FieldingLine[], norms: FieldingNorms): FieldingRatings {
  const usable = lines.filter((l) => norms.has(l.section) && l.games > 0)
  if (usable.length === 0) return DEFAULT_FIELDING
  const blend = (key: 'rangeFactor' | 'assists' | 'pct', subset = usable) => {
    const games = subset.reduce((s, l) => s + l.games, 0)
    return (
      subset.reduce((s, l) => {
        const d = norms.get(l.section)![key]
        return s + z(regress(l[key], l.games, d.mean, FIELDING_K), d) * l.games
      }, 0) / games
    )
  }
  // Throwing arm only shows up in assists for outfielders and catchers.
  const throwing = usable.filter((l) => l.section === '外野手' || l.section === '捕手')
  return {
    range: toRating(blend('rangeFactor')),
    arm: throwing.length > 0 ? toRating(blend('assists', throwing)) : DEFAULT_FIELDING.arm,
    hands: toRating(blend('pct')),
  }
}
