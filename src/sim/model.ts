import type { Player } from '../domain/types'
import { randNormal, weightedPick, type Rng } from './rng'

/**
 * Plate appearance outcomes. GO/FO/LO are ground, fly and line outs; E is
 * reaching on an error. Double plays and sacrifice flies are decided by the
 * baserunning step from GO and FO.
 */
export type Outcome = 'K' | 'BB' | 'HBP' | '1B' | '2B' | '3B' | 'HR' | 'GO' | 'FO' | 'LO' | 'E'

export const OUTCOMES: Outcome[] = ['K', 'BB', 'HBP', '1B', '2B', '3B', 'HR', 'GO', 'FO', 'LO', 'E']

/** NPB-like league averages per plate appearance. Tuned by scripts/calibrate.ts. */
export const BASELINE = {
  k: 0.195,
  bb: 0.075,
  hbp: 0.009,
  hr: 0.022,
  /** Hits per ball in play (excluding HR). */
  babip: 0.29,
  /** Share of balls-in-play hits that are doubles / triples. */
  doubleShare: 0.18,
  tripleShare: 0.018,
  /** Share of balls-in-play outs by type. */
  groundOutShare: 0.46,
  lineOutShare: 0.14,
  /** Chance a ball-in-play out becomes an error. */
  error: 0.014,
}

export interface DefenseRatings {
  range: number
  hands: number
}

export interface PAContext {
  batter: Player
  pitcher: Player
  /** Pitches thrown so far by this pitcher. */
  pitchCount: number
  defense: DefenseRatings
}

/** Rating 1–100 to roughly [-1, 1], where 50 is 0. */
function d(rating: number): number {
  return (rating - 50) / 50
}

function scale(base: number, rating: number, strength: number): number {
  return base * Math.exp(strength * d(rating))
}

/** Odds-ratio (log5) combination of a batter rate and a pitcher rate against the league rate. */
export function log5(batter: number, pitcher: number, league: number): number {
  const odds = (batter / (1 - batter)) * (pitcher / (1 - pitcher)) / (league / (1 - league))
  return odds / (1 + odds)
}

/** Pitches a pitcher can throw before tiring. */
export function pitchLimit(pitcher: Player): number {
  return 15 + (pitcher.pitching?.stamina ?? 1)
}

/** Rating points subtracted from stuff and control because of fatigue. */
export function fatiguePenalty(pitcher: Player, pitchCount: number): number {
  return Math.max(0, pitchCount - pitchLimit(pitcher)) * 0.6
}

/** Same-handed matchups favor the pitcher. Switch hitters always get the platoon advantage. */
function platoonBonus(batter: Player, pitcher: Player): number {
  if (batter.bats === 'S') return 2
  return batter.bats === pitcher.throws ? -4 : 2
}

export function outcomeProbabilities(ctx: PAContext): Record<Outcome, number> {
  const { batter, pitcher, pitchCount, defense } = ctx
  const B = BASELINE
  const platoon = platoonBonus(batter, pitcher)
  const contact = batter.batting.contact + platoon
  const power = batter.batting.power + platoon
  const { eye, speed } = batter.batting
  const penalty = fatiguePenalty(pitcher, pitchCount)
  const stuff = (pitcher.pitching?.stuff ?? 1) - penalty
  const control = (pitcher.pitching?.control ?? 1) - penalty

  const k = log5(scale(B.k, contact, -0.6), scale(B.k, stuff, 0.6), B.k)
  const bb = log5(scale(B.bb, eye, 0.6), scale(B.bb, control, -0.6), B.bb)
  const hbp = scale(B.hbp, control, -0.4)
  const hr = log5(scale(B.hr, power, 1.2), scale(B.hr, stuff, -0.5), B.hr)

  const bip = Math.max(0, 1 - k - bb - hbp - hr)
  const babip =
    B.babip *
    Math.exp(0.15 * d(contact) + 0.05 * d(speed) - 0.1 * d(stuff) - 0.08 * d(defense.range))
  const hits = bip * babip
  const triples = hits * scale(B.tripleShare, speed, 0.8)
  const doubles = hits * scale(B.doubleShare, power, 0.4)
  const singles = hits - doubles - triples

  const outs = bip - hits
  const errors = outs * scale(B.error, defense.hands, -0.8)
  const fieldOuts = outs - errors
  const groundShare = B.groundOutShare * Math.exp(-0.2 * d(power))
  const go = fieldOuts * groundShare
  const lo = fieldOuts * B.lineOutShare
  const fo = fieldOuts - go - lo

  return { K: k, BB: bb, HBP: hbp, '1B': singles, '2B': doubles, '3B': triples, HR: hr, GO: go, FO: fo, LO: lo, E: errors }
}

export function rollOutcome(rng: Rng, ctx: PAContext): Outcome {
  return weightedPick(rng, outcomeProbabilities(ctx))
}

const MEAN_PITCHES: Record<Outcome, number> = {
  K: 4.8,
  BB: 5.7,
  HBP: 3.2,
  '1B': 3.4,
  '2B': 3.4,
  '3B': 3.4,
  HR: 3.4,
  GO: 3.3,
  FO: 3.5,
  LO: 3.3,
  E: 3.3,
}

/** Number of pitches in a plate appearance that ended with `outcome`. */
export function pitchesForPA(rng: Rng, outcome: Outcome): number {
  const min = outcome === 'K' ? 3 : outcome === 'BB' ? 4 : 1
  return Math.round(randNormal(rng, MEAN_PITCHES[outcome], 1.4, min, 12))
}
