import { describe, expect, test } from 'bun:test'
import { DEFAULT_LEAGUE_RULES } from '../domain/rules'
import { validateLineup, validateRoster } from '../domain/validate'
import { createGame, simulateToEnd } from '../sim/game'
import { npbTeams } from './npb'

const teams = npbTeams()

describe('npbTeams', () => {
  test('has the six teams of each league', () => {
    const names = (league: string) => teams.filter((t) => t.league === league).map((t) => t.shortName).sort()
    expect(names('central')).toEqual(['DeNA', 'ヤクルト', '中日', '巨人', '広島', '阪神'].sort())
    expect(names('pacific')).toEqual(['オリックス', 'ソフトバンク', 'ロッテ', '日本ハム', '楽天', '西武'].sort())
  })

  test('uses official team names', () => {
    expect(teams.map((t) => t.name)).toContain('阪神タイガース')
    expect(teams.map((t) => t.name)).toContain('福岡ソフトバンクホークス')
  })

  test('every team is a legal 一軍 with a valid lineup', () => {
    for (const team of teams) {
      const rules = DEFAULT_LEAGUE_RULES[team.league]
      expect(team.roster).toHaveLength(31)
      expect(team.roster.filter((p) => p.pitching)).toHaveLength(15)
      expect(validateRoster(team, rules)).toEqual([])
      expect(validateLineup(team, rules)).toEqual([])
    }
  })

  test('ratings are within 1–100 and ids are unique', () => {
    const ids = teams.flatMap((t) => t.roster.map((p) => p.id))
    expect(new Set(ids).size).toBe(ids.length)
    for (const p of teams.flatMap((t) => t.roster)) {
      const values = [
        ...Object.values(p.batting),
        ...Object.values(p.fielding),
        ...Object.values(p.pitching ?? {}),
      ]
      for (const v of values) {
        expect(v).toBeGreaterThanOrEqual(1)
        expect(v).toBeLessThanOrEqual(100)
      }
    }
  })

  test('returns a copy that callers can change', () => {
    npbTeams()[0].name = 'changed'
    expect(npbTeams()[0].name).not.toBe('changed')
  })

  test('real teams can play a full 交流戦 game', () => {
    const home = teams.find((t) => t.league === 'pacific')!
    const away = teams.find((t) => t.league === 'central')!
    const g = createGame({
      away,
      home,
      seed: 1,
      rules: DEFAULT_LEAGUE_RULES[home.league],
      controllers: { away: 'cpu', home: 'cpu' },
    })
    simulateToEnd(g)
    expect(g.status).toBe('final')
  })
})
