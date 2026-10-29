import type { Lineup, LineupSlot, Player, Position, Team } from './types'

/** Overall hitting value, used to rank batters. */
export const batValue = (p: Player) =>
  p.batting.contact * 0.4 + p.batting.power * 0.35 + p.batting.eye * 0.15 + p.batting.speed * 0.1
const fieldValue = (p: Player) => p.fielding.range * 0.5 + p.fielding.arm * 0.25 + p.fielding.hands * 0.25
const pitchValue = (p: Player) => (p.pitching ? p.pitching.stuff + p.pitching.control : 0)

/** Positions filled from hardest to staff, with how much defense matters there. */
const FILL_ORDER: [Exclude<Position, 'DH' | 'P'>, number][] = [
  ['C', 0.6],
  ['SS', 0.5],
  ['2B', 0.45],
  ['CF', 0.45],
  ['3B', 0.3],
  ['RF', 0.25],
  ['LF', 0.2],
  ['1B', 0.1],
]

function takeBest(pool: Player[], score: (p: Player) => number): Player | undefined {
  if (pool.length === 0) return undefined
  const best = pool.reduce((a, b) => (score(b) > score(a) ? b : a))
  pool.splice(pool.indexOf(best), 1)
  return best
}

/** Classic Japanese batting order: 1番 speed, 2番 contact, 3–5 the heart of the order. */
function battingOrder(starters: LineupSlot[], byId: Map<string, Player>): LineupSlot[] {
  const pool = [...starters]
  const p = (s: LineupSlot) => byId.get(s.playerId)!
  const take = (score: (pl: Player) => number) => {
    const best = pool.reduce((a, b) => (score(p(b)) > score(p(a)) ? b : a))
    pool.splice(pool.indexOf(best), 1)
    return best
  }
  const cleanup = take((x) => x.batting.power * 0.6 + x.batting.contact * 0.4)
  const third = take(batValue)
  const fifth = take((x) => x.batting.power * 0.5 + batValue(x) * 0.5)
  const leadoff = take((x) => x.batting.speed * 0.5 + x.batting.eye * 0.3 + x.batting.contact * 0.2)
  const second = take((x) => x.batting.contact * 0.6 + x.batting.eye * 0.2 + x.batting.speed * 0.2)
  const rest = pool.sort((a, b) => batValue(p(b)) - batValue(p(a)))
  return [leadoff, second, third, cleanup, fifth, ...rest]
}

/** おまかせ: builds a sensible lineup, rotation choice and bullpen from the roster. */
export function autoLineup(team: Pick<Team, 'roster'>, benchLimit = 26): Lineup {
  const byId = new Map(team.roster.map((p) => [p.id, p]))
  const fielders = team.roster.filter((p) => !p.pitching)
  const pitchers = team.roster.filter((p) => p.pitching)

  const pool = [...fielders]
  const starters: LineupSlot[] = []
  for (const [pos, weight] of FILL_ORDER) {
    const eligible = pool.filter((p) => p.positions.includes(pos))
    const pick =
      takeBest(eligible, (p) => batValue(p) + fieldValue(p) * weight) ?? takeBest([...pool], batValue)
    if (!pick) continue
    pool.splice(pool.indexOf(pick), 1)
    starters.push({ playerId: pick.id, position: pos })
  }
  const dh = takeBest(pool, batValue)
  if (dh) starters.push({ playerId: dh.id, position: 'DH' })

  const isStarter = (p: Player) => (p.pitching?.stamina ?? 0) >= 50
  const rotation = pitchers.filter(isStarter).sort((a, b) => pitchValue(b) - pitchValue(a))
  const ace = rotation[0] ?? [...pitchers].sort((a, b) => pitchValue(b) - pitchValue(a))[0]
  // The best reliever is used last, as the closer.
  const bullpen = pitchers
    .filter((p) => p !== ace && !isStarter(p))
    .sort((a, b) => pitchValue(a) - pitchValue(b))
    .map((p) => p.id)

  const benchOut: string[] = []
  const overflow = () => team.roster.length - benchOut.length - benchLimit
  for (const p of rotation.slice(1)) if (overflow() > 0) benchOut.push(p.id)
  const extras = [...pool].sort((a, b) => batValue(a) - batValue(b))
  for (const p of extras) if (overflow() > 0) benchOut.push(p.id)

  return {
    order: starters.length === 9 ? battingOrder(starters, byId) : starters,
    startingPitcherId: ace?.id ?? '',
    bullpen,
    benchOut,
  }
}
