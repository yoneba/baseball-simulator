import { describe, expect, test } from 'bun:test'
import { advanceRunners, type Bases, type Runner } from './baserunning'
import { OUTCOMES, type Outcome } from './model'
import { createRng, type Rng } from './rng'

const runner = (id: string): Runner => ({ playerId: id, pitcherId: 'p', earned: true })
const batter = runner('B')
const speedOf = () => 50
/** chance() always succeeds. */
const yes: Rng = { next: () => 0, state: 0 }
/** chance() always fails. */
const no: Rng = { next: () => 0.999, state: 0 }

function bases(mask: number): Bases {
  return [mask & 1 ? runner('R1') : null, mask & 2 ? runner('R2') : null, mask & 4 ? runner('R3') : null]
}

const run = (rng: Rng, outcome: Outcome, mask: number, outs = 0) =>
  advanceRunners(rng, { bases: bases(mask), outs, outcome, batter, speedOf })

const ids = (b: Bases) => b.map((r) => r?.playerId ?? null)

describe('advanceRunners invariants', () => {
  const rng = createRng(1)
  for (const outcome of OUTCOMES) {
    for (let mask = 0; mask < 8; mask++) {
      for (let outs = 0; outs < 3; outs++) {
        test(`${outcome} bases=${mask.toString(2).padStart(3, '0')} outs=${outs}`, () => {
          for (let i = 0; i < 20; i++) {
            const r = run(rng, outcome, mask, outs)
            const onBase = r.bases.filter(Boolean).length
            const before = bases(mask).filter(Boolean).length + 1
            expect(r.outsAdded).toBeGreaterThanOrEqual(0)
            expect(outs + r.outsAdded).toBeLessThanOrEqual(3)
            if (outs + r.outsAdded < 3) {
              expect(onBase + r.scored.length + r.outsAdded).toBe(before)
            } else {
              expect(onBase).toBe(0)
              expect(r.scored).toEqual([])
            }
            const placed = r.bases.filter(Boolean).map((x) => x!.playerId)
            expect(new Set(placed).size).toBe(placed.length)
          }
        })
      }
    }
  }
})

describe('advanceRunners cases', () => {
  test('grand slam scores four', () => {
    const r = run(no, 'HR', 0b111)
    expect(r.scored.map((x) => x.playerId)).toEqual(['R3', 'R2', 'R1', 'B'])
    expect(ids(r.bases)).toEqual([null, null, null])
  })

  test('walk only forces runners', () => {
    expect(ids(run(no, 'BB', 0b010).bases)).toEqual(['B', 'R2', null])
    expect(ids(run(no, 'BB', 0b101).bases)).toEqual(['B', 'R1', 'R3'])
    expect(run(no, 'BB', 0b111).scored.map((x) => x.playerId)).toEqual(['R3'])
  })

  test('single: aggressive and conservative running', () => {
    const fast = run(yes, '1B', 0b011)
    expect(fast.scored.map((x) => x.playerId)).toEqual(['R2'])
    expect(ids(fast.bases)).toEqual(['B', null, 'R1'])
    const slow = run(no, '1B', 0b011)
    expect(slow.scored).toEqual([])
    expect(ids(slow.bases)).toEqual(['B', 'R1', 'R2'])
  })

  test('ground ball double play', () => {
    const r = run(yes, 'GO', 0b001, 0)
    expect(r.special).toBe('DP')
    expect(r.outsAdded).toBe(2)
    expect(ids(r.bases)).toEqual([null, null, null])
  })

  test('double play ending the inning cancels the run', () => {
    const r = run(yes, 'GO', 0b101, 1)
    expect(r.outsAdded).toBe(2)
    expect(r.scored).toEqual([])
  })

  test('sacrifice fly', () => {
    const r = run(yes, 'FO', 0b100, 1)
    expect(r.special).toBe('SF')
    expect(r.scored.map((x) => x.playerId)).toEqual(['R3'])
  })

  test('no sacrifice fly with two outs', () => {
    const r = run(yes, 'FO', 0b100, 2)
    expect(r.special).toBeNull()
    expect(r.scored).toEqual([])
    expect(r.outsAdded).toBe(1)
  })

  test('runner reaching on an error is unearned', () => {
    const r = run(no, 'E', 0)
    expect(r.bases[0]?.earned).toBe(false)
  })
})
