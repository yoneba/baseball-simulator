import { describe, expect, test } from 'bun:test'
import { createRng, randInt, randNormal, weightedPick } from './rng'

describe('createRng', () => {
  test('is deterministic for a seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    const seqA = Array.from({ length: 100 }, () => a.next())
    const seqB = Array.from({ length: 100 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  test('different seeds give different sequences', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next())
  })

  test('can be resumed from its state', () => {
    const a = createRng(7)
    for (let i = 0; i < 10; i++) a.next()
    const b = createRng(a.state)
    expect(b.next()).toBe(a.next())
  })

  test('values are in [0, 1) and roughly uniform', () => {
    const rng = createRng(123)
    let sum = 0
    for (let i = 0; i < 10000; i++) {
      const x = rng.next()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
      sum += x
    }
    expect(sum / 10000).toBeCloseTo(0.5, 1)
  })
})

describe('helpers', () => {
  test('randInt stays within bounds', () => {
    const rng = createRng(5)
    for (let i = 0; i < 1000; i++) {
      const n = randInt(rng, 1, 6)
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(6)
    }
  })

  test('randNormal respects clamps and mean', () => {
    const rng = createRng(9)
    let sum = 0
    for (let i = 0; i < 5000; i++) {
      const n = randNormal(rng, 50, 12, 1, 100)
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(100)
      sum += n
    }
    expect(Math.abs(sum / 5000 - 50)).toBeLessThan(1)
  })

  test('weightedPick follows the weights', () => {
    const rng = createRng(11)
    const counts = { a: 0, b: 0, c: 0 }
    for (let i = 0; i < 10000; i++) counts[weightedPick(rng, { a: 1, b: 3, c: 0 })]++
    expect(counts.c).toBe(0)
    expect(counts.b / counts.a).toBeGreaterThan(2.5)
    expect(counts.b / counts.a).toBeLessThan(3.5)
  })
})
