import { describe, expect, test } from 'bun:test'
import { DEFAULT_LEAGUE_RULES } from '../domain/rules'
import { makeTeam } from '../test/fixtures'
import { buildBoxScore } from './boxscore'
import { describeEvent } from './describe'
import {
  advance,
  applyManagerAction,
  availableBench,
  battingSide,
  createGame,
  fieldingSide,
  replayGame,
  simulateToEnd,
  type GameSetup,
  type GameState,
  type PAEvent,
  type SubEvent,
} from './game'

const noDH = { ...DEFAULT_LEAGUE_RULES.central, dh: false }

function setup(seed: number, overrides: Partial<GameSetup> = {}): GameSetup {
  return {
    away: makeTeam('a'),
    home: makeTeam('h'),
    seed,
    rules: DEFAULT_LEAGUE_RULES.pacific,
    controllers: { away: 'user', home: 'user' },
    ...overrides,
  }
}

/** Plays until `pred` holds, failing the test if the game ends first. */
function playUntil(g: GameState, pred: (g: GameState) => boolean): void {
  while (!pred(g)) {
    if (g.status === 'final') throw new Error('game ended before the condition was met')
    advance(g)
  }
}

describe('代打', () => {
  test('replaces the current batter, who cannot return', () => {
    const g = createGame(setup(1))
    const side = battingSide(g)
    const out = g[side].order[0].playerId
    applyManagerAction(g, { type: 'pinchHit', side, playerId: 'a10' })
    expect(g[side].order[0]).toEqual({ playerId: 'a10', position: 'CF' })
    expect(g[side].removed).toContain(out)
    advance(g)
    expect((g.events.at(-1) as PAEvent).batterId).toBe('a10')
    expect(availableBench(g[side]).map((p) => p.id)).not.toContain(out)
    expect(() => applyManagerAction(g, { type: 'pinchHit', side, playerId: 'a10' })).toThrow('その選手は出場できません。')
  })

  test('only the batting team can pinch hit', () => {
    const g = createGame(setup(1))
    expect(() => applyManagerAction(g, { type: 'pinchHit', side: 'home', playerId: 'h10' })).toThrow(
      '攻撃中のチームのみ代打を送れます。',
    )
  })

  test('pinch hitting for the pitcher brings in a reliever next half', () => {
    const g = createGame(setup(3, { rules: noDH }))
    playUntil(g, (x) => x.half === 'bottom' && x.home.batterIndex === 4 && x.outs < 3)
    applyManagerAction(g, { type: 'pinchHit', side: 'home', playerId: 'h10' })
    playUntil(g, (x) => x.half === 'top' && x.inning >= 2)
    advance(g)
    expect(g.home.pitcherId).not.toBe('h20')
    expect(g.home.order[4]).toEqual({ playerId: g.home.pitcherId, position: 'P' })
    expect(g.home.removed).toEqual(expect.arrayContaining(['h20', 'h10']))
  })
})

describe('代走', () => {
  test('replaces the runner on base', () => {
    const g = createGame(setup(2))
    playUntil(g, (x) => x.bases[0] !== null && x.half === 'top')
    const runner = g.bases[0]!.playerId
    applyManagerAction(g, { type: 'pinchRun', side: 'away', base: 1, playerId: 'a12' })
    expect(g.bases[0]?.playerId).toBe('a12')
    expect(g.away.order.some((s) => s.playerId === 'a12')).toBe(true)
    expect(g.away.removed).toContain(runner)
  })

  test('needs a runner on that base', () => {
    const g = createGame(setup(2))
    expect(() => applyManagerAction(g, { type: 'pinchRun', side: 'away', base: 3, playerId: 'a12' })).toThrow(
      'その塁に走者がいません。',
    )
  })
})

describe('CPU manager', () => {
  const cpu = (seed: number, rules = DEFAULT_LEAGUE_RULES.pacific) => {
    const g = createGame(setup(seed, { rules, controllers: { away: 'cpu', home: 'cpu' } }))
    simulateToEnd(g)
    return g
  }

  test('uses the closer in save situations', () => {
    const games = Array.from({ length: 100 }, (_, i) => cpu(i + 1))
    const saves = games.flatMap((g) => [...buildBoxScore(g).pitching.away, ...buildBoxScore(g).pitching.home]).filter(
      (p) => p.decision === 'S',
    )
    expect(saves.length).toBeGreaterThan(10)
    // The closer is the last pitcher in the bullpen order.
    expect(saves.filter((p) => p.playerId.endsWith('31')).length / saves.length).toBeGreaterThan(0.6)
  })

  test('pinch hits for the pitcher late in non-DH games, with consistent box scores', () => {
    const games = Array.from({ length: 60 }, (_, i) => cpu(i + 1, noDH))
    const pinch = games.filter((g) => g.events.some((e) => e.type === 'sub' && e.kind === 'pinchHitter'))
    expect(pinch.length).toBeGreaterThan(10)
    for (const g of pinch) {
      const box = buildBoxScore(g)
      for (const side of ['away', 'home'] as const) {
        expect(box.batting[side].reduce((s, l) => s + l.r, 0)).toBe(g.score[side])
        expect(box.batting[side].some((l) => l.role === '代打')).toBe(
          g.events.some((e) => e.type === 'sub' && e.kind === 'pinchHitter' && e.side === side),
        )
      }
      g.events.forEach((e, i) => expect(describeEvent(g, e, i)).not.toContain('?'))
    }
  })

  test('substitutes only bench players who have not played', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const g = cpu(seed, noDH)
      for (const side of ['away', 'home'] as const) {
        const subs = g.events.filter((e): e is SubEvent => e.type === 'sub' && e.side === side)
        const ins = subs.map((e) => e.inId)
        expect(new Set(ins).size).toBe(ins.length)
      }
    }
  })
})

describe('replay with manager moves', () => {
  test('rebuilds the same game', () => {
    const s = setup(11, { rules: noDH, controllers: { away: 'cpu', home: 'user' } })
    const live = createGame(s)
    const recorded: { at: number; action: Parameters<typeof applyManagerAction>[1] }[] = []
    const act = (action: Parameters<typeof applyManagerAction>[1]) => {
      recorded.push({ at: live.events.length, action })
      applyManagerAction(live, action)
    }
    playUntil(live, (x) => x.half === 'bottom' && x.outs < 3)
    act({ type: 'pinchHit', side: 'home', playerId: 'h11' })
    playUntil(live, (x) => fieldingSide(x) === 'home' && x.inning >= 4)
    act({ type: 'changePitcher', side: 'home', pitcherId: 'h28' })
    simulateToEnd(live)
    expect(replayGame(s, recorded).events).toEqual(live.events)
  })
})
