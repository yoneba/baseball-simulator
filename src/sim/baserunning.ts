import type { Outcome } from './model'
import { chance, type Rng } from './rng'

export interface Runner {
  playerId: string
  /** 責任投手: the pitcher charged if this runner scores. */
  pitcherId: string
  /** False when the runner reached on an error, so the run is unearned. */
  earned: boolean
}

/** Runners on first, second and third. */
export type Bases = [Runner | null, Runner | null, Runner | null]

export const EMPTY_BASES: Bases = [null, null, null]

export type BaseFrom = 'batter' | 1 | 2 | 3
export type BaseTo = 1 | 2 | 3 | 'home' | 'out'

export interface Movement {
  playerId: string
  from: BaseFrom
  to: BaseTo
}

/** Special plays decided by baserunning: 併殺, 犠飛 and 野選 (force out at second). */
export type SpecialPlay = 'DP' | 'SF' | 'FC'

export interface AdvanceInput {
  bases: Bases
  outs: number
  outcome: Outcome
  batter: Runner
  speedOf: (playerId: string) => number
}

export interface AdvanceResult {
  bases: Bases
  outsAdded: number
  scored: Runner[]
  /** Moves that changed a base, in order from the lead runner to the batter. */
  movements: Movement[]
  special: SpecialPlay | null
}

/** Speed rating to a probability adjustment in [-0.2, 0.2]. */
function speedAdj(speed: number): number {
  return ((speed - 50) / 50) * 0.2
}

export function advanceRunners(rng: Rng, input: AdvanceInput): AdvanceResult {
  const { bases, outs, outcome, speedOf } = input
  const batter = outcome === 'E' ? { ...input.batter, earned: false } : input.batter
  const [r1, r2, r3] = bases
  const next: Bases = [null, null, null]
  let scored: Runner[] = []
  let movements: Movement[] = []
  let outsAdded = 0
  let special: SpecialPlay | null = null

  const move = (runner: Runner, from: BaseFrom, to: BaseTo) => {
    movements.push({ playerId: runner.playerId, from, to })
    if (to === 'home') scored.push(runner)
    else if (to === 'out') outsAdded++
    else next[to - 1] = runner
  }
  const stay = (runner: Runner | null, base: 1 | 2 | 3) => {
    if (runner) next[base - 1] = runner
  }
  const adj = (r: Runner) => speedAdj(speedOf(r.playerId))
  const thirdFree = () => next[2] === null

  switch (outcome) {
    case 'K':
      outsAdded = 1
      stay(r1, 1)
      stay(r2, 2)
      stay(r3, 3)
      break

    case 'BB':
    case 'HBP':
      if (r3) {
        if (r1 && r2) move(r3, 3, 'home')
        else stay(r3, 3)
      }
      if (r2) {
        if (r1) move(r2, 2, 3)
        else stay(r2, 2)
      }
      if (r1) move(r1, 1, 2)
      move(batter, 'batter', 1)
      break

    case '1B':
      if (r3) move(r3, 3, 'home')
      if (r2) move(r2, 2, chance(rng, 0.55 + adj(r2)) ? 'home' : 3)
      if (r1) move(r1, 1, thirdFree() && chance(rng, 0.27 + adj(r1)) ? 3 : 2)
      move(batter, 'batter', 1)
      break

    case '2B':
      if (r3) move(r3, 3, 'home')
      if (r2) move(r2, 2, 'home')
      if (r1) move(r1, 1, chance(rng, 0.4 + adj(r1)) ? 'home' : 3)
      move(batter, 'batter', 2)
      break

    case '3B':
      for (const [r, from] of [[r3, 3], [r2, 2], [r1, 1]] as const) if (r) move(r, from, 'home')
      move(batter, 'batter', 3)
      break

    case 'HR':
      for (const [r, from] of [[r3, 3], [r2, 2], [r1, 1]] as const) if (r) move(r, from, 'home')
      move(batter, 'batter', 'home')
      break

    case 'E':
      if (r3) move(r3, 3, 'home')
      if (r2) move(r2, 2, 3)
      if (r1) move(r1, 1, 2)
      move(batter, 'batter', 1)
      break

    case 'GO':
      if (outs < 2 && r1) {
        if (chance(rng, 0.5 - speedAdj(speedOf(batter.playerId)))) {
          special = 'DP'
          if (r3) move(r3, 3, 'home')
          if (r2) move(r2, 2, 3)
          move(r1, 1, 'out')
          move(batter, 'batter', 'out')
        } else if (chance(rng, 0.4)) {
          special = 'FC'
          if (r3) move(r3, 3, 'home')
          if (r2) move(r2, 2, 3)
          move(r1, 1, 'out')
          move(batter, 'batter', 1)
        } else {
          if (r3) move(r3, 3, 'home')
          if (r2) move(r2, 2, 3)
          move(r1, 1, 2)
          move(batter, 'batter', 'out')
        }
      } else if (outs < 2) {
        if (r3) {
          if (chance(rng, 0.5 + adj(r3))) move(r3, 3, 'home')
          else stay(r3, 3)
        }
        if (r2) {
          if (thirdFree() && chance(rng, 0.55)) move(r2, 2, 3)
          else stay(r2, 2)
        }
        move(batter, 'batter', 'out')
      } else {
        stay(r1, 1)
        stay(r2, 2)
        stay(r3, 3)
        move(batter, 'batter', 'out')
      }
      break

    case 'FO':
      if (outs < 2 && r3 && chance(rng, 0.6 + adj(r3))) {
        special = 'SF'
        move(r3, 3, 'home')
      } else {
        stay(r3, 3)
      }
      if (r2) {
        if (outs < 2 && thirdFree() && chance(rng, 0.3 + adj(r2))) move(r2, 2, 3)
        else stay(r2, 2)
      }
      stay(r1, 1)
      move(batter, 'batter', 'out')
      break

    case 'LO':
      stay(r3, 3)
      stay(r2, 2)
      move(batter, 'batter', 'out')
      if (r1 && outs < 2 && chance(rng, 0.06)) {
        special = 'DP'
        move(r1, 1, 'out')
      } else {
        stay(r1, 1)
      }
      break
  }

  // No run counts on a play that makes the third out.
  if (outs + outsAdded >= 3) {
    scored = []
    movements = movements.filter((m) => m.to !== 'home')
    if (special === 'SF') special = null
    return { bases: [null, null, null], outsAdded: 3 - outs, scored, movements, special }
  }
  return { bases: next, outsAdded, scored, movements, special }
}
