import { resolveBattingOrder } from '../domain/rules'
import type { Position } from '../domain/types'
import type { GameState, PAEvent, Side } from './game'
import type { Outcome } from './model'

const HITS: Outcome[] = ['1B', '2B', '3B', 'HR']

export type Decision = '勝' | '敗' | 'S'

/** How a player entered the batting order: a starting position, or 投/打/走 for substitutes. */
export type EntryRole = Position | '代打' | '代走' | '投'

export interface BattingLine {
  playerId: string
  slot: number
  role: EntryRole
  pa: number
  ab: number
  r: number
  h: number
  rbi: number
  bb: number
  so: number
  hr: number
}

export interface PitchingLine {
  playerId: string
  outs: number
  bf: number
  pitches: number
  h: number
  hr: number
  bb: number
  so: number
  r: number
  er: number
  decision: Decision | null
}

export interface BoxScore {
  lineScore: Record<Side, number[]>
  totals: Record<Side, { r: number; h: number; e: number }>
  batting: Record<Side, BattingLine[]>
  pitching: Record<Side, PitchingLine[]>
}

/** 6 outs → "2", 19 outs → "6 1/3". */
export function formatInnings(outs: number): string {
  const whole = Math.floor(outs / 3)
  const rem = outs % 3
  return rem === 0 ? `${whole}` : `${whole} ${rem}/3`
}

/** 打率 or other rate stats: .312 style, or "-" with no denominator. */
export function formatAverage(num: number, den: number): string {
  if (den === 0) return '-'
  return (num / den).toFixed(3).replace(/^0/, '')
}

/** 防御率. */
export function formatEra(er: number, outs: number): string {
  if (outs === 0) return er > 0 ? '∞' : '-'
  return ((er * 27) / outs).toFixed(2)
}

function emptyBatting(playerId: string, slot: number, role: EntryRole): BattingLine {
  return { playerId, slot, role, pa: 0, ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0, hr: 0 }
}

function emptyPitching(playerId: string): PitchingLine {
  return { playerId, outs: 0, bf: 0, pitches: 0, h: 0, hr: 0, bb: 0, so: 0, r: 0, er: 0, decision: null }
}

export function buildBoxScore(g: GameState): BoxScore {
  const sides = ['away', 'home'] as const
  const batting = { away: [] as BattingLine[], home: [] as BattingLine[] }
  const pitching = { away: [] as PitchingLine[], home: [] as PitchingLine[] }
  const totals = { away: { r: 0, h: 0, e: 0 }, home: { r: 0, h: 0, e: 0 } }
  const order: Record<Side, string[]> = { away: [], home: [] }
  const current: Record<Side, string> = { away: '', home: '' }
  const batLine = { away: new Map<string, BattingLine>(), home: new Map<string, BattingLine>() }
  const pitchLine = { away: new Map<string, PitchingLine>(), home: new Map<string, PitchingLine>() }

  for (const side of sides) {
    const team = g.setup[side]
    resolveBattingOrder(team.lineup, g.setup.rules.dh).forEach((s, i) => {
      const line = emptyBatting(s.playerId, i, s.position)
      batting[side].push(line)
      batLine[side].set(s.playerId, line)
      order[side].push(s.playerId)
    })
    current[side] = team.lineup.startingPitcherId
    const line = emptyPitching(current[side])
    pitching[side].push(line)
    pitchLine[side].set(current[side], line)
  }

  // Lead tracking for 勝利投手/敗戦投手: who was pitching when the winner last took the lead.
  const score = { away: 0, home: 0 }
  let goAhead: { winnerPitcher: string; loserPitcher: string } | null = null
  const enteredWithLead = new Map<string, number>()

  for (const e of g.events) {
    if (e.type === 'sub') {
      const slot = order[e.side].indexOf(e.outId)
      const role: EntryRole = e.kind === 'pitcher' ? '投' : e.kind === 'pinchHitter' ? '代打' : '代走'
      if (slot >= 0) {
        order[e.side][slot] = e.inId
        const line = emptyBatting(e.inId, slot, role)
        const at = batting[e.side].findLastIndex((l) => l.slot === slot) + 1
        batting[e.side].splice(at, 0, line)
        batLine[e.side].set(e.inId, line)
      }
      if (e.kind === 'pitcher') {
        current[e.side] = e.inId
        const line = emptyPitching(e.inId)
        pitching[e.side].push(line)
        pitchLine[e.side].set(e.inId, line)
        const other = e.side === 'away' ? 'home' : 'away'
        enteredWithLead.set(e.inId, score[e.side] - score[other])
      }
      continue
    }
    if (e.type !== 'pa') continue

    const bat: Side = e.half === 'top' ? 'away' : 'home'
    const fld: Side = bat === 'away' ? 'home' : 'away'
    const b = batLine[bat].get(e.batterId)!
    const p = pitchLine[fld].get(e.pitcherId)!
    applyPA(e, b, p)
    if (HITS.includes(e.outcome)) totals[bat].h++
    if (e.outcome === 'E') totals[fld].e++

    const before = score[bat] - score[fld]
    for (const run of e.runs) {
      batLine[bat].get(run.playerId)!.r++
      const charged = pitchLine[fld].get(run.pitcherId)!
      charged.r++
      if (run.earned) charged.er++
    }
    score[bat] = e.scoreAfter[bat]
    totals[bat].r = score[bat]
    const after = score[bat] - score[fld]
    if (before <= 0 && after > 0) {
      // The go-ahead run is the (|before| + 1)-th run on the play.
      // The batting team's current pitcher is its pitcher of record.
      goAhead = { winnerPitcher: current[bat], loserPitcher: e.runs[-before].pitcherId }
    }
  }

  if (g.result && g.result !== 'tie' && goAhead) {
    const winner = g.result
    const loser = winner === 'away' ? 'home' : 'away'
    let win = pitchLine[winner].get(goAhead.winnerPitcher)!
    const starter = pitching[winner][0]
    // A starter needs 5 innings for the win; otherwise it goes to the reliever who got the most outs.
    if (win === starter && starter.outs < 15) {
      const relievers = pitching[winner].slice(1)
      if (relievers.length > 0) win = relievers.reduce((a, b) => (b.outs > a.outs ? b : a))
    }
    win.decision = '勝'
    pitchLine[loser].get(goAhead.loserPitcher)!.decision = '敗'
    const finisher = pitching[winner].at(-1)!
    const lead = enteredWithLead.get(finisher.playerId)
    if (finisher !== win && lead !== undefined && lead > 0 && (lead <= 3 || finisher.outs >= 9)) {
      finisher.decision = 'S'
    }
  }

  return { lineScore: g.lineScore, totals, batting, pitching }
}

function applyPA(e: PAEvent, b: BattingLine, p: PitchingLine): void {
  b.pa++
  p.bf++
  p.pitches += e.pitches
  p.outs += e.outsAfter - e.outsBefore
  const walk = e.outcome === 'BB' || e.outcome === 'HBP'
  if (!walk && e.special !== 'SF') b.ab++
  if (walk) {
    b.bb++
    p.bb++
  }
  if (e.outcome === 'K') {
    b.so++
    p.so++
  }
  if (HITS.includes(e.outcome)) {
    b.h++
    p.h++
  }
  if (e.outcome === 'HR') {
    b.hr++
    p.hr++
  }
  b.rbi += e.rbi
}
