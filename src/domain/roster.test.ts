import { describe, expect, test } from 'bun:test'
import { makePitcher, makePlayer, makeTeam } from '../test/fixtures'
import { freeNumber, ratingGrade, removePlayer, upsertPlayer } from './roster'

describe('roster helpers', () => {
  test('removePlayer clears every lineup reference', () => {
    const team = makeTeam('a')
    const noBatter = removePlayer(team, 'a1')
    expect(noBatter.roster.some((p) => p.id === 'a1')).toBe(false)
    expect(noBatter.lineup.order[0]).toEqual({ playerId: '', position: 'CF' })
    const noStarter = removePlayer(team, 'a20')
    expect(noStarter.lineup.startingPitcherId).toBe('')
    const noReliever = removePlayer(team, 'a21')
    expect(noReliever.lineup.bullpen).not.toContain('a21')
  })

  test('upsertPlayer adds relievers to the bullpen', () => {
    const team = makeTeam('a')
    const reliever = makePitcher('a50', { number: 50, pitching: { stuff: 50, control: 50, stamina: 20 } })
    expect(upsertPlayer(team, reliever).lineup.bullpen.at(-1)).toBe('a50')
    const starter = makePitcher('a51', { number: 51, pitching: { stuff: 50, control: 50, stamina: 80 } })
    expect(upsertPlayer(team, starter).lineup.bullpen).not.toContain('a51')
  })

  test('upsertPlayer replaces and drops non-pitchers from the staff', () => {
    const team = makeTeam('a')
    const converted = { ...team.roster.find((p) => p.id === 'a21')!, pitching: undefined, positions: ['LF' as const] }
    const next = upsertPlayer(team, converted)
    expect(next.roster).toHaveLength(team.roster.length)
    expect(next.lineup.bullpen).not.toContain('a21')
  })

  test('freeNumber skips used numbers', () => {
    const team = makeTeam('a')
    team.roster.push(makePlayer('x', { number: 0 }))
    expect(freeNumber(team)).toBe(14)
    expect(freeNumber(team, 40)).toBe(40)
  })

  test('ratingGrade', () => {
    expect(ratingGrade(95)).toBe('S')
    expect(ratingGrade(50)).toBe('D')
    expect(ratingGrade(5)).toBe('G')
  })
})
