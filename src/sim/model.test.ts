import { describe, expect, test } from 'bun:test'
import { makePitcher, makePlayer } from '../test/fixtures'
import { log5, OUTCOMES, outcomeProbabilities, pitchesForPA, type PAContext } from './model'
import { createRng } from './rng'

const avgDefense = { range: 50, hands: 50 }

function ctx(overrides: Partial<PAContext> = {}): PAContext {
  return {
    batter: makePlayer('b1', { bats: 'L' }),
    pitcher: makePitcher('p1'),
    pitchCount: 0,
    defense: avgDefense,
    ...overrides,
  }
}

describe('log5', () => {
  test('average vs average gives the league rate', () => {
    expect(log5(0.2, 0.2, 0.2)).toBeCloseTo(0.2, 10)
  })

  test('is symmetric and monotonic', () => {
    expect(log5(0.3, 0.2, 0.2)).toBeCloseTo(0.3, 10)
    expect(log5(0.3, 0.25, 0.2)).toBeGreaterThan(0.3)
  })
})

describe('outcomeProbabilities', () => {
  test('sums to 1 with every outcome non-negative', () => {
    const p = outcomeProbabilities(ctx())
    const total = OUTCOMES.reduce((s, o) => s + p[o], 0)
    expect(total).toBeCloseTo(1, 10)
    for (const o of OUTCOMES) expect(p[o]).toBeGreaterThanOrEqual(0)
  })

  test('still sums to 1 for extreme ratings', () => {
    const batter = makePlayer('b', { batting: { contact: 100, power: 100, eye: 100, speed: 100 } })
    const pitcher = makePitcher('p', { pitching: { stuff: 1, control: 1, stamina: 1 } })
    const p = outcomeProbabilities(ctx({ batter, pitcher, pitchCount: 150 }))
    expect(OUTCOMES.reduce((s, o) => s + p[o], 0)).toBeCloseTo(1, 10)
    for (const o of OUTCOMES) expect(p[o]).toBeGreaterThanOrEqual(0)
  })

  test('more power means more home runs', () => {
    const weak = outcomeProbabilities(ctx())
    const strong = outcomeProbabilities(
      ctx({ batter: makePlayer('b', { bats: 'L', batting: { contact: 50, power: 90, eye: 50, speed: 50 } }) }),
    )
    expect(strong.HR).toBeGreaterThan(weak.HR * 2)
  })

  test('better stuff means more strikeouts', () => {
    const avg = outcomeProbabilities(ctx())
    const ace = outcomeProbabilities(
      ctx({ pitcher: makePitcher('p', { pitching: { stuff: 90, control: 50, stamina: 50 } }) }),
    )
    expect(ace.K).toBeGreaterThan(avg.K)
  })

  test('better control means fewer walks', () => {
    const avg = outcomeProbabilities(ctx())
    const control = outcomeProbabilities(
      ctx({ pitcher: makePitcher('p', { pitching: { stuff: 50, control: 90, stamina: 50 } }) }),
    )
    expect(control.BB).toBeLessThan(avg.BB)
  })

  test('fatigue helps the batter', () => {
    const fresh = outcomeProbabilities(ctx({ pitchCount: 20 }))
    const tired = outcomeProbabilities(ctx({ pitchCount: 120 }))
    expect(tired.K).toBeLessThan(fresh.K)
    expect(tired.BB).toBeGreaterThan(fresh.BB)
  })

  test('same-handed matchups favor the pitcher', () => {
    const opposite = outcomeProbabilities(ctx())
    const same = outcomeProbabilities(ctx({ batter: makePlayer('b1', { bats: 'R' }) }))
    expect(same.K).toBeGreaterThan(opposite.K)
  })

  test('sure-handed defense makes fewer errors', () => {
    const avg = outcomeProbabilities(ctx())
    const good = outcomeProbabilities(ctx({ defense: { range: 50, hands: 90 } }))
    expect(good.E).toBeLessThan(avg.E)
  })
})

describe('pitchesForPA', () => {
  test('respects minimums', () => {
    const rng = createRng(3)
    for (let i = 0; i < 500; i++) {
      expect(pitchesForPA(rng, 'K')).toBeGreaterThanOrEqual(3)
      expect(pitchesForPA(rng, 'BB')).toBeGreaterThanOrEqual(4)
      expect(pitchesForPA(rng, 'GO')).toBeGreaterThanOrEqual(1)
    }
  })
})
