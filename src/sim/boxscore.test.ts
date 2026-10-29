import { describe, expect, test } from 'bun:test'
import { DEFAULT_LEAGUE_RULES } from '../domain/rules'
import { makeTeam } from '../test/fixtures'
import { buildBoxScore, formatAverage, formatEra, formatInnings } from './boxscore'
import { describeEvent } from './describe'
import { createGame, simulateToEnd, type PAEvent } from './game'

const games = Array.from({ length: 100 }, (_, i) => {
  const g = createGame({
    away: makeTeam('a'),
    home: makeTeam('h', 'central'),
    seed: 1000 + i,
    rules: { ...DEFAULT_LEAGUE_RULES.central, dh: i % 2 === 0 },
    controllers: { away: 'cpu', home: 'cpu' },
  })
  simulateToEnd(g)
  return g
})

describe('buildBoxScore', () => {
  test('totals match the score and the play log', () => {
    for (const g of games) {
      const box = buildBoxScore(g)
      for (const side of ['away', 'home'] as const) {
        const other = side === 'away' ? 'home' : 'away'
        const lines = box.batting[side]
        const pitchers = box.pitching[other]
        const sum = (f: (l: (typeof lines)[number]) => number) => lines.reduce((s, l) => s + f(l), 0)
        expect(box.totals[side].r).toBe(g.score[side])
        expect(sum((l) => l.r)).toBe(g.score[side])
        expect(sum((l) => l.h)).toBe(box.totals[side].h)
        expect(pitchers.reduce((s, p) => s + p.r, 0)).toBe(g.score[side])
        expect(pitchers.reduce((s, p) => s + p.h, 0)).toBe(box.totals[side].h)
        for (const p of pitchers) expect(p.er).toBeLessThanOrEqual(p.r)
        const pas = g.events.filter((e) => e.type === 'pa' && e.half === (side === 'away' ? 'top' : 'bottom'))
        expect(sum((l) => l.pa)).toBe(pas.length)
        expect(pitchers.reduce((s, p) => s + p.outs, 0)).toBe(
          (pas as PAEvent[]).reduce((s, e) => s + e.outsAfter - e.outsBefore, 0),
        )
      }
    }
  })

  test('assigns exactly one win and loss unless tied', () => {
    for (const g of games) {
      const all = [...buildBoxScore(g).pitching.away, ...buildBoxScore(g).pitching.home]
      const count = (d: string) => all.filter((p) => p.decision === d).length
      if (g.result === 'tie') {
        expect(count('勝') + count('敗') + count('S')).toBe(0)
      } else {
        expect(count('勝')).toBe(1)
        expect(count('敗')).toBe(1)
        expect(count('S')).toBeLessThanOrEqual(1)
        const winners = buildBoxScore(g).pitching[g.result!]
        expect(winners.some((p) => p.decision === '勝')).toBe(true)
      }
    }
  })

  test('relievers appear in the batting order without the DH', () => {
    const noDH = games.filter((g) => !g.setup.rules.dh)
    const withReliever = noDH.some((g) => buildBoxScore(g).batting.home.some((l) => l.role === '投'))
    expect(withReliever).toBe(true)
  })
})

describe('formatting', () => {
  test('innings pitched', () => {
    expect(formatInnings(0)).toBe('0')
    expect(formatInnings(19)).toBe('6 1/3')
    expect(formatInnings(27)).toBe('9')
  })

  test('average and ERA', () => {
    expect(formatAverage(1, 3)).toBe('.333')
    expect(formatAverage(0, 0)).toBe('-')
    expect(formatEra(3, 27)).toBe('3.00')
    expect(formatEra(1, 0)).toBe('∞')
  })
})

describe('describeEvent', () => {
  test('describes every event in Japanese', () => {
    const seen = new Set<string>()
    for (const g of games) {
      g.events.forEach((e, i) => {
        const text = describeEvent(g, e, i)
        expect(text.length).toBeGreaterThan(0)
        expect(text).not.toContain('undefined')
        expect(text).not.toContain('?')
        if (e.type === 'pa') seen.add(e.outcome)
      })
    }
    expect(seen.size).toBe(11)
  })

  test('reads like a broadcast', () => {
    const g = games[0]
    const hr = g.events.findIndex((e) => e.type === 'pa' && e.outcome === 'HR')
    if (hr >= 0) expect(describeEvent(g, g.events[hr], hr)).toMatch(/ホームラン！/)
    const end = g.events.length - 1
    expect(describeEvent(g, g.events[end], end)).toMatch(/勝利|引き分け/)
  })
})
