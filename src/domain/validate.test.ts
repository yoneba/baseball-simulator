import { describe, expect, test } from 'bun:test'
import { makePitcher, makePlayer, makeTeam } from '../test/fixtures'
import { DEFAULT_LEAGUE_RULES, resolveBattingOrder, resolveGameRules } from './rules'
import { validateLineup, validateRoster } from './validate'

const rules = DEFAULT_LEAGUE_RULES.pacific

describe('validateRoster', () => {
  test('accepts a valid roster', () => {
    expect(validateRoster(makeTeam(), rules)).toEqual([])
  })

  test('rejects more than 31 players', () => {
    const team = makeTeam()
    for (let i = 0; i < 7; i++) team.roster.push(makePlayer(`x${i}`, { number: 60 + i }))
    expect(validateRoster(team, rules)).toEqual(['一軍登録は31人までです(現在32人)。'])
  })

  test('enforces the 外国人枠', () => {
    const team = makeTeam()
    for (const p of team.roster.slice(0, 5)) p.foreign = true
    const errors = validateRoster(team, rules)
    expect(errors.some((e) => e.startsWith('外国人選手の一軍登録は4人まで'))).toBe(true)
    expect(errors.some((e) => e.startsWith('外国人野手は3人まで'))).toBe(true)
  })

  test('allows 2 foreign pitchers and 2 foreign fielders', () => {
    const team = makeTeam()
    team.roster[0].foreign = true
    team.roster[1].foreign = true
    team.roster[20].foreign = true
    team.roster[21].foreign = true
    expect(validateRoster(team, rules)).toEqual([])
  })

  test('rejects duplicate uniform numbers', () => {
    const team = makeTeam()
    team.roster[1].number = team.roster[0].number
    expect(validateRoster(team, rules)).toContain('背番号1が重複しています。')
  })
})

describe('validateLineup', () => {
  test('accepts a valid lineup', () => {
    expect(validateLineup(makeTeam(), rules)).toEqual([])
  })

  test('rejects a missing position and duplicate player', () => {
    const team = makeTeam()
    team.lineup.order[1] = { ...team.lineup.order[0] }
    const errors = validateLineup(team, rules)
    expect(errors).toContain('選手a1が打順に重複しています。')
    expect(errors).toContain('ショートが決まっていません。')
    expect(errors).toContain('センターが2人います。')
  })

  test('rejects a player out of position', () => {
    const team = makeTeam()
    team.lineup.order[0].position = 'C'
    team.lineup.order[8].position = 'CF'
    expect(validateLineup(team, rules)).toContain('選手a1はキャッチャーを守れません。')
  })

  test('rejects a non-pitcher as starter', () => {
    const team = makeTeam()
    team.lineup.startingPitcherId = 'a10'
    expect(validateLineup(team, rules)).toContain('選手a10は投手ではありません。')
  })

  test('enforces the 26-man bench', () => {
    const team = makeTeam()
    team.roster.push(makePitcher('a40', { number: 40 }), makePitcher('a41', { number: 41 }))
    expect(validateLineup(team, rules)).toEqual(['ベンチ入りは26人までです(現在27人)。'])
    team.lineup.benchOut = ['a41']
    expect(validateLineup(team, rules)).toEqual([])
  })
})

describe('rules', () => {
  test('交流戦 follows the home league', () => {
    const custom = { ...DEFAULT_LEAGUE_RULES, central: { ...DEFAULT_LEAGUE_RULES.central, dh: false } }
    expect(resolveGameRules('central', custom).dh).toBe(false)
    expect(resolveGameRules('pacific', custom).dh).toBe(true)
  })

  test('without the DH the pitcher bats in the DH slot', () => {
    const team = makeTeam()
    const order = resolveBattingOrder(team.lineup, false)
    expect(order[4]).toEqual({ playerId: 'a20', position: 'P' })
    expect(resolveBattingOrder(team.lineup, true)[4].position).toBe('DH')
  })
})
