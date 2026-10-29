import { describe, expect, test } from 'bun:test'
import { autoLineup } from '../domain/autoLineup'
import { DEFAULT_LEAGUE_RULES } from '../domain/rules'
import { validateLineup, validateRoster } from '../domain/validate'
import { displayName } from '../sim/describe'
import { createGame, simulateToEnd } from '../sim/game'
import { createRng } from '../sim/rng'
import { generateDefaultTeams, generatePlayer, generateTeam } from './generate'
import { TEAM_SEEDS } from './teams'

const teams = generateDefaultTeams()
const rules = DEFAULT_LEAGUE_RULES.central

describe('generateDefaultTeams', () => {
  test('creates six fictional teams per league', () => {
    expect(teams).toHaveLength(12)
    expect(teams.filter((t) => t.league === 'central')).toHaveLength(6)
    expect(teams.filter((t) => t.league === 'pacific')).toHaveLength(6)
    expect(new Set(teams.map((t) => t.shortName)).size).toBe(12)
  })

  test('every team is a legal 31-man roster with a valid lineup', () => {
    for (const team of teams) {
      expect(team.roster).toHaveLength(31)
      expect(validateRoster(team, rules)).toEqual([])
      expect(validateLineup(team, rules)).toEqual([])
      expect(team.roster.filter((p) => p.foreign)).toHaveLength(4)
    }
  })

  test('surnames are unique within a team', () => {
    for (const team of teams) {
      const names = team.roster.map(displayName)
      expect(new Set(names).size).toBe(names.length)
    }
  })

  test('is deterministic for a seed', () => {
    expect(generateDefaultTeams(7)).toEqual(generateDefaultTeams(7))
    expect(generateDefaultTeams(7)).not.toEqual(generateDefaultTeams(8))
  })

  test('generated teams can play a full game', () => {
    const g = createGame({
      away: teams[0],
      home: teams[6],
      seed: 1,
      rules: DEFAULT_LEAGUE_RULES.pacific,
      controllers: { away: 'cpu', home: 'cpu' },
    })
    simulateToEnd(g)
    expect(g.status).toBe('final')
  })
})

describe('generatePlayer', () => {
  test('pitchers pitch and catchers catch', () => {
    const rng = createRng(1)
    const sp = generatePlayer(rng, 'SP', { id: 'x', number: '18' })
    expect(sp.pitching!.stamina).toBeGreaterThanOrEqual(55)
    expect(sp.positions).toEqual(['P'])
    const rp = generatePlayer(rng, 'RP', { id: 'y', number: '30' })
    expect(rp.pitching!.stamina).toBeLessThanOrEqual(45)
    const c = generatePlayer(rng, 'C', { id: 'z', number: '2' })
    expect(c.positions[0]).toBe('C')
    expect(c.throws).toBe('R')
    expect(c.pitching).toBeUndefined()
  })

  test('foreign players get katakana names', () => {
    const p = generatePlayer(createRng(3), 'OF', { id: 'f', number: '44', foreign: true })
    expect(p.foreign).toBe(true)
    expect(p.name).toMatch(/^[ァ-ヶー]+・[ァ-ヶー]+$/)
    expect(displayName(p)).toBe(p.name.split('・')[1])
  })
})

describe('autoLineup', () => {
  test('bats the best hitters and saves the best reliever for last', () => {
    const team = generateTeam(createRng(5), TEAM_SEEDS[0])
    const lineup = autoLineup(team)
    const byId = new Map(team.roster.map((p) => [p.id, p]))
    const value = (id: string) => byId.get(id)!.pitching!.stuff + byId.get(id)!.pitching!.control
    const last = lineup.bullpen.at(-1)!
    for (const id of lineup.bullpen) expect(value(id)).toBeLessThanOrEqual(value(last))
    expect(lineup.benchOut).toHaveLength(5)
    expect(lineup.order.map((s) => s.position).sort()).toEqual(['1B', '2B', '3B', 'C', 'CF', 'DH', 'LF', 'RF', 'SS'])
  })
})
