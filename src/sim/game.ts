import { resolveBattingOrder } from '../domain/rules'
import type { LeagueRules, LineupSlot, Player, Team } from '../domain/types'
import { advanceRunners, EMPTY_BASES, type Bases, type Movement, type SpecialPlay } from './baserunning'
import { pitchesForPA, rollOutcome, type DefenseRatings, type Outcome } from './model'
import { createRng } from './rng'

export type Side = 'away' | 'home'
export type Half = 'top' | 'bottom'
export type Controller = 'user' | 'cpu'

export interface PitcherLine {
  pitches: number
  outs: number
  runs: number
}

export interface TeamGameState {
  team: Team
  players: Record<string, Player>
  /** Current batting order. Substitutes replace the slot they enter. */
  order: LineupSlot[]
  /** Index into `order` of the next batter. */
  batterIndex: number
  pitcherId: string
  starterId: string
  /** Pitchers who have appeared, in order. */
  pitchersUsed: string[]
  pitcherLines: Record<string, PitcherLine>
  /** Players who left the game and may not return. */
  removed: string[]
  controller: Controller
}

export interface PAEvent {
  type: 'pa'
  inning: number
  half: Half
  batterId: string
  pitcherId: string
  outcome: Outcome
  special: SpecialPlay | null
  pitches: number
  outsBefore: number
  outsAfter: number
  basesBefore: (string | null)[]
  basesAfter: (string | null)[]
  movements: Movement[]
  /** Runs that scored, each charged to the runner's 責任投手. */
  runs: { playerId: string; pitcherId: string; earned: boolean }[]
  rbi: number
  scoreAfter: Record<Side, number>
}

export interface SubEvent {
  type: 'sub'
  kind: 'pitcher' | 'pinchHitter' | 'pinchRunner'
  side: Side
  inning: number
  half: Half
  inId: string
  outId: string
}

export interface HalfEndEvent {
  type: 'halfEnd'
  inning: number
  half: Half
  runs: number
}

export interface GameEndEvent {
  type: 'gameEnd'
  result: Side | 'tie'
  walkoff: boolean
}

export type GameEvent = PAEvent | SubEvent | HalfEndEvent | GameEndEvent

export type ManagerAction = { type: 'changePitcher'; side: Side; pitcherId: string }

export interface GameSetup {
  away: Team
  home: Team
  seed: number
  /** Rules after resolving the home team's league (交流戦 included). */
  rules: LeagueRules
  controllers: Record<Side, Controller>
}

export interface GameState {
  setup: GameSetup
  rngState: number
  inning: number
  half: Half
  outs: number
  bases: Bases
  score: Record<Side, number>
  lineScore: Record<Side, number[]>
  away: TeamGameState
  home: TeamGameState
  events: GameEvent[]
  status: 'inProgress' | 'final'
  result: Side | 'tie' | null
}

export const battingSide = (g: GameState): Side => (g.half === 'top' ? 'away' : 'home')
export const fieldingSide = (g: GameState): Side => (g.half === 'top' ? 'home' : 'away')
export const otherSide = (side: Side): Side => (side === 'away' ? 'home' : 'away')

function createTeamState(team: Team, useDH: boolean, controller: Controller): TeamGameState {
  const starterId = team.lineup.startingPitcherId
  return {
    team,
    players: Object.fromEntries(team.roster.map((p) => [p.id, p])),
    order: resolveBattingOrder(team.lineup, useDH).map((s) => ({ ...s })),
    batterIndex: 0,
    pitcherId: starterId,
    starterId,
    pitchersUsed: [starterId],
    pitcherLines: { [starterId]: { pitches: 0, outs: 0, runs: 0 } },
    removed: [],
    controller,
  }
}

export function createGame(setup: GameSetup): GameState {
  return {
    setup,
    rngState: setup.seed >>> 0,
    inning: 1,
    half: 'top',
    outs: 0,
    bases: [...EMPTY_BASES],
    score: { away: 0, home: 0 },
    lineScore: { away: [0], home: [] },
    away: createTeamState(setup.away, setup.rules.dh, setup.controllers.away),
    home: createTeamState(setup.home, setup.rules.dh, setup.controllers.home),
    events: [],
    status: 'inProgress',
    result: null,
  }
}

/** Average defense of the eight fielders behind the pitcher. Out-of-position players field worse. */
export function defenseRatings(team: TeamGameState): DefenseRatings {
  const fielders = team.order.filter((s) => s.position !== 'DH' && s.position !== 'P')
  let range = 0
  let hands = 0
  for (const slot of fielders) {
    const p = team.players[slot.playerId]
    const penalty = slot.position !== 'DH' && p.positions.includes(slot.position) ? 0 : 20
    range += p.fielding.range - penalty
    hands += p.fielding.hands - penalty
  }
  return { range: range / fielders.length, hands: hands / fielders.length }
}

/** Relievers who are on the bench and have not pitched yet. */
export function availableRelievers(team: TeamGameState): Player[] {
  const out = new Set(team.team.lineup.benchOut)
  return team.team.roster.filter(
    (p) => p.pitching && !out.has(p.id) && !team.pitchersUsed.includes(p.id) && !team.removed.includes(p.id),
  )
}

/** Applies a manager move. Throws if the move is illegal. */
export function applyManagerAction(g: GameState, action: ManagerAction): void {
  if (g.status === 'final') throw new Error('試合は終了しています。')
  const team = g[action.side]
  if (action.side !== fieldingSide(g)) throw new Error('守備中のチームのみ投手交代できます。')
  if (!availableRelievers(team).some((p) => p.id === action.pitcherId)) {
    throw new Error('その投手は登板できません。')
  }
  const outId = team.pitcherId
  team.removed.push(outId)
  team.pitcherId = action.pitcherId
  team.pitchersUsed.push(action.pitcherId)
  team.pitcherLines[action.pitcherId] = { pitches: 0, outs: 0, runs: 0 }
  // Without the DH the new pitcher takes over the old pitcher's batting slot.
  const slot = team.order.find((s) => s.playerId === outId)
  if (slot) slot.playerId = action.pitcherId
  g.events.push({ type: 'sub', kind: 'pitcher', side: action.side, inning: g.inning, half: g.half, inId: action.pitcherId, outId })
}

function endGame(g: GameState, result: Side | 'tie', walkoff: boolean): void {
  g.status = 'final'
  g.result = result
  g.events.push({ type: 'gameEnd', result, walkoff })
}

function endHalf(g: GameState): void {
  const side = battingSide(g)
  g.events.push({ type: 'halfEnd', inning: g.inning, half: g.half, runs: g.lineScore[side][g.inning - 1] })
  const { regulationInnings, maxInnings } = g.setup.rules
  g.outs = 0
  g.bases = [...EMPTY_BASES]

  if (g.half === 'top') {
    if (g.inning >= regulationInnings && g.score.home > g.score.away) return endGame(g, 'home', false)
    g.half = 'bottom'
    g.lineScore.home.push(0)
    return
  }
  if (g.inning >= regulationInnings && g.score.home !== g.score.away) {
    return endGame(g, g.score.home > g.score.away ? 'home' : 'away', false)
  }
  if (g.inning >= maxInnings) return endGame(g, 'tie', false)
  g.inning++
  g.half = 'top'
  g.lineScore.away.push(0)
}

/** Simulates the next plate appearance. Mutates `g`. */
export function step(g: GameState): void {
  if (g.status === 'final') return
  const rng = createRng(g.rngState)
  const bat = battingSide(g)
  const offense = g[bat]
  const defense = g[fieldingSide(g)]

  const batter = offense.players[offense.order[offense.batterIndex].playerId]
  const pitcher = defense.players[defense.pitcherId]
  const line = defense.pitcherLines[pitcher.id]

  const outcome = rollOutcome(rng, {
    batter,
    pitcher,
    pitchCount: line.pitches,
    defense: defenseRatings(defense),
  })
  const pitches = pitchesForPA(rng, outcome)
  const adv = advanceRunners(rng, {
    bases: g.bases,
    outs: g.outs,
    outcome,
    batter: { playerId: batter.id, pitcherId: pitcher.id, earned: true },
    speedOf: (id) => offense.players[id].batting.speed,
  })

  // サヨナラ: only the runs needed to win count, except on a home run.
  let scored = adv.scored
  const { regulationInnings } = g.setup.rules
  const walkoffPossible = g.half === 'bottom' && g.inning >= regulationInnings
  if (walkoffPossible && outcome !== 'HR') {
    const needed = g.score.away - g.score.home + 1
    if (needed > 0 && scored.length > needed) scored = scored.slice(0, needed)
  }

  line.pitches += pitches
  line.outs += adv.outsAdded
  for (const r of scored) defense.pitcherLines[r.pitcherId].runs++

  const basesBefore = g.bases.map((r) => r?.playerId ?? null)
  const outsBefore = g.outs
  g.outs += adv.outsAdded
  g.bases = adv.bases
  g.score[bat] += scored.length
  g.lineScore[bat][g.inning - 1] += scored.length
  offense.batterIndex = (offense.batterIndex + 1) % offense.order.length
  g.rngState = rng.state

  g.events.push({
    type: 'pa',
    inning: g.inning,
    half: g.half,
    batterId: batter.id,
    pitcherId: pitcher.id,
    outcome,
    special: adv.special,
    pitches,
    outsBefore,
    outsAfter: g.outs,
    basesBefore,
    basesAfter: g.bases.map((r) => r?.playerId ?? null),
    movements: adv.movements.filter((m) => m.to !== 'home' || scored.some((r) => r.playerId === m.playerId)),
    runs: scored.map((r) => ({ ...r })),
    rbi: outcome === 'E' || adv.special === 'DP' ? 0 : scored.length,
    scoreAfter: { ...g.score },
  })

  if (walkoffPossible && g.score.home > g.score.away) return endGame(g, 'home', true)
  if (g.outs >= 3) endHalf(g)
}

/** Basic CPU bullpen use: relieve tired or battered pitchers and give relievers one inning. */
export function cpuActions(g: GameState, side: Side): ManagerAction[] {
  if (g.status === 'final' || side !== fieldingSide(g)) return []
  const team = g[side]
  const pitcher = team.players[team.pitcherId]
  const line = team.pitcherLines[team.pitcherId]
  const isStarter = team.pitcherId === team.starterId
  const limit = 15 + (pitcher.pitching?.stamina ?? 1)
  const startOfHalf = g.outs === 0 && g.bases.every((b) => b === null)

  const tired = line.pitches >= limit
  const battered = isStarter ? line.runs >= 5 : line.runs >= 3
  const inningDone = !isStarter && startOfHalf && line.outs >= 3
  if (!tired && !battered && !inningDone) return []

  const next = team.team.lineup.bullpen
    .map((id) => team.players[id])
    .find((p) => p && availableRelievers(team).includes(p))
  return next ? [{ type: 'changePitcher', side, pitcherId: next.id }] : []
}

/** Lets CPU-controlled sides make their moves, then plays the next plate appearance. */
export function advance(g: GameState): void {
  for (const side of ['away', 'home'] as const) {
    if (g[side].controller === 'cpu') for (const a of cpuActions(g, side)) applyManagerAction(g, a)
  }
  step(g)
}

export function simulateToEnd(g: GameState): void {
  while (g.status !== 'final') advance(g)
}

/** A user move, recorded with the number of events that existed when it was made. */
export interface RecordedAction {
  at: number
  action: ManagerAction
}

/** Rebuilds a game from its setup and recorded user moves. */
export function replayGame(setup: GameSetup, actions: RecordedAction[], untilEvents = Infinity): GameState {
  const g = createGame(setup)
  let next = 0
  while (g.status !== 'final' && g.events.length < untilEvents) {
    while (next < actions.length && actions[next].at <= g.events.length) {
      applyManagerAction(g, actions[next].action)
      next++
    }
    advance(g)
  }
  return g
}
