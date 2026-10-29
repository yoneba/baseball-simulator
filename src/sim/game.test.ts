import { describe, expect, test } from 'bun:test'
import { DEFAULT_LEAGUE_RULES } from '../domain/rules'
import type { Team } from '../domain/types'
import { makeTeam } from '../test/fixtures'
import {
  advance,
  applyManagerAction,
  availableRelievers,
  createGame,
  fieldingSide,
  replayGame,
  simulateToEnd,
  step,
  type GameSetup,
  type PAEvent,
} from './game'

function setup(seed: number, overrides: Partial<GameSetup> = {}): GameSetup {
  return {
    away: makeTeam('a'),
    home: makeTeam('h'),
    seed,
    rules: DEFAULT_LEAGUE_RULES.pacific,
    controllers: { away: 'cpu', home: 'cpu' },
    ...overrides,
  }
}

function play(s: GameSetup) {
  const g = createGame(s)
  simulateToEnd(g)
  return g
}

/** Makes every batter weak and every pitcher dominant, so games stay low-scoring. */
function pitchersDuel(team: Team): Team {
  for (const p of team.roster) {
    p.batting = { contact: 5, power: 5, eye: 5, speed: 50 }
    if (p.pitching) p.pitching = { stuff: 100, control: 100, stamina: 100 }
  }
  return team
}

const games = Array.from({ length: 200 }, (_, i) => play(setup(i + 1)))

describe('game flow', () => {
  test('every game finishes with a consistent score', () => {
    for (const g of games) {
      expect(g.status).toBe('final')
      for (const side of ['away', 'home'] as const) {
        expect(g.lineScore[side].reduce((a, b) => a + b, 0)).toBe(g.score[side])
      }
      const last = g.events.at(-1)
      expect(last?.type).toBe('gameEnd')
      if (g.result === 'tie') expect(g.score.home).toBe(g.score.away)
      else expect(g.score[g.result!]).toBeGreaterThan(g.score[g.result === 'home' ? 'away' : 'home'])
    }
  })

  test('games last 9 to 12 innings', () => {
    for (const g of games) {
      expect(g.inning).toBeGreaterThanOrEqual(9)
      expect(g.inning).toBeLessThanOrEqual(12)
    }
  })

  test('the home team skips the bottom half when it is already ahead', () => {
    const skipped = games.filter((g) => g.lineScore.home.length < g.lineScore.away.length)
    expect(skipped.length).toBeGreaterThan(0)
    for (const g of skipped) expect(g.result).toBe('home')
  })

  test('walk-offs end the game immediately', () => {
    const walkoffs = games.filter((g) => {
      const last = g.events.at(-1)
      return last?.type === 'gameEnd' && last.walkoff
    })
    expect(walkoffs.length).toBeGreaterThan(0)
    for (const g of walkoffs) {
      const pa = g.events.filter((e): e is PAEvent => e.type === 'pa').at(-1)!
      expect(pa.half).toBe('bottom')
      if (pa.outcome !== 'HR') expect(g.score.home - g.score.away).toBe(1)
    }
  })

  test('each half inning has three outs unless the game ended in it', () => {
    for (const g of games.slice(0, 20)) {
      for (const e of g.events) {
        if (e.type !== 'halfEnd') continue
        const last = g.events.filter(
          (x): x is PAEvent => x.type === 'pa' && x.inning === e.inning && x.half === e.half,
        ).at(-1)!
        expect(last.outsAfter).toBe(3)
      }
    }
  })

  test('a game tied after the 12th ends as 引き分け', () => {
    const ties = Array.from({ length: 60 }, (_, i) =>
      play(setup(i + 1, { away: pitchersDuel(makeTeam('a')), home: pitchersDuel(makeTeam('h')) })),
    ).filter((g) => g.result === 'tie')
    expect(ties.length).toBeGreaterThan(0)
    for (const g of ties) {
      expect(g.inning).toBe(12)
      expect(g.lineScore.home).toHaveLength(12)
    }
  })

  test('is deterministic for a seed', () => {
    expect(play(setup(99)).events).toEqual(play(setup(99)).events)
    expect(play(setup(99)).events).not.toEqual(play(setup(100)).events)
  })
})

describe('DH', () => {
  const batters = (dh: boolean) =>
    new Set(
      play(setup(5, { rules: { ...DEFAULT_LEAGUE_RULES.central, dh } }))
        .events.filter((e): e is PAEvent => e.type === 'pa' && e.half === 'top')
        .map((e) => e.batterId),
    )

  test('pitchers bat only without the DH', () => {
    expect(batters(true).has('a20')).toBe(false)
    expect(batters(true).has('a5')).toBe(true)
    expect(batters(false).has('a20')).toBe(true)
    expect(batters(false).has('a5')).toBe(false)
  })
})

describe('pitching', () => {
  test('the CPU uses the bullpen', () => {
    for (const g of games.slice(0, 20)) {
      expect(g.home.pitchersUsed.length).toBeGreaterThan(1)
      expect(g.events.some((e) => e.type === 'sub' && e.kind === 'pitcher')).toBe(true)
    }
  })

  test('pitch counts add up', () => {
    const g = games[0]
    const fromEvents = g.events
      .filter((e): e is PAEvent => e.type === 'pa' && e.pitcherId === 'h20')
      .reduce((s, e) => s + e.pitches, 0)
    expect(g.home.pitcherLines.h20.pitches).toBe(fromEvents)
  })

  test('a removed pitcher cannot return', () => {
    const g = createGame(setup(1, { controllers: { away: 'user', home: 'user' } }))
    step(g)
    const side = fieldingSide(g)
    applyManagerAction(g, { type: 'changePitcher', side, pitcherId: 'h21' })
    expect(g.home.pitcherId).toBe('h21')
    expect(() => applyManagerAction(g, { type: 'changePitcher', side, pitcherId: 'h20' })).toThrow()
    expect(availableRelievers(g.home).map((p) => p.id)).not.toContain('h20')
  })

  test('only the fielding team can change pitchers', () => {
    const g = createGame(setup(1, { controllers: { away: 'user', home: 'user' } }))
    expect(() => applyManagerAction(g, { type: 'changePitcher', side: 'away', pitcherId: 'a21' })).toThrow()
  })

  test('without the DH the reliever takes the pitcher batting slot', () => {
    const g = createGame(setup(1, { rules: { ...DEFAULT_LEAGUE_RULES.central, dh: false }, controllers: { away: 'user', home: 'user' } }))
    applyManagerAction(g, { type: 'changePitcher', side: 'home', pitcherId: 'h21' })
    expect(g.home.order[4]).toEqual({ playerId: 'h21', position: 'P' })
  })
})

describe('replayGame', () => {
  test('replays user moves exactly', () => {
    const s = setup(42, { controllers: { away: 'cpu', home: 'user' } })
    const live = createGame(s)
    for (let i = 0; i < 10; i++) advance(live)
    const action = { type: 'changePitcher' as const, side: 'home' as const, pitcherId: 'h25' }
    const recorded = [{ at: live.events.length, action }]
    applyManagerAction(live, action)
    simulateToEnd(live)
    expect(replayGame(s, recorded).events).toEqual(live.events)
  })
})
