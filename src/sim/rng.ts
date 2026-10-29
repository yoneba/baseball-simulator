/** A seeded PRNG. The same seed always produces the same sequence. */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number
  /** Current internal state, so a game can be paused and resumed. */
  readonly state: number
}

/** mulberry32: small, fast and good enough for a game simulation. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    get state() {
      return a
    },
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32)
}

/** Integer in [min, max]. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng.next() * (max - min + 1))
}

export function chance(rng: Rng, p: number): boolean {
  return rng.next() < p
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng.next() * items.length)]
}

/** Approximately normal (sum of uniforms), clamped to [min, max]. */
export function randNormal(rng: Rng, mean: number, sd: number, min = -Infinity, max = Infinity): number {
  let sum = 0
  for (let i = 0; i < 6; i++) sum += rng.next()
  const z = (sum - 3) / Math.sqrt(0.5)
  return Math.min(max, Math.max(min, mean + z * sd))
}

/** Picks a key with probability proportional to its weight. */
export function weightedPick<K extends string>(rng: Rng, weights: Record<K, number>): K {
  const entries = Object.entries(weights) as [K, number][]
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = rng.next() * total
  for (const [key, w] of entries) {
    r -= w
    if (r < 0) return key
  }
  return entries[entries.length - 1][0]
}
