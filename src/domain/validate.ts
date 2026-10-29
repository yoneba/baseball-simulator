import { LINEUP_POSITIONS, POSITION_NAME } from './positions'
import type { LeagueRules, Team } from './types'

/** Checks the 一軍登録 limits. Returns Japanese error messages. */
export function validateRoster(team: Team, rules: LeagueRules): string[] {
  const errors: string[] = []
  const { roster } = team

  if (roster.length > rules.rosterLimit) {
    errors.push(`一軍登録は${rules.rosterLimit}人までです(現在${roster.length}人)。`)
  }

  const foreign = roster.filter((p) => p.foreign)
  const foreignPitchers = foreign.filter((p) => p.pitching).length
  const foreignFielders = foreign.length - foreignPitchers
  if (foreign.length > rules.foreignLimit) {
    errors.push(`外国人選手の一軍登録は${rules.foreignLimit}人までです(現在${foreign.length}人)。`)
  }
  if (foreignPitchers > rules.foreignPerRoleLimit) {
    errors.push(`外国人投手は${rules.foreignPerRoleLimit}人までです(現在${foreignPitchers}人)。`)
  }
  if (foreignFielders > rules.foreignPerRoleLimit) {
    errors.push(`外国人野手は${rules.foreignPerRoleLimit}人までです(現在${foreignFielders}人)。`)
  }

  const numbers = new Set<number>()
  for (const p of roster) {
    if (numbers.has(p.number)) errors.push(`背番号${p.number}が重複しています。`)
    numbers.add(p.number)
  }
  return errors
}

/** Checks that the team's lineup can start a game. Returns Japanese error messages. */
export function validateLineup(team: Team, rules: LeagueRules): string[] {
  const errors: string[] = []
  const { lineup } = team
  const byId = new Map(team.roster.map((p) => [p.id, p]))
  const benchOut = new Set(lineup.benchOut)
  const nameOf = (id: string) => byId.get(id)?.name ?? '不明な選手'

  if (lineup.order.length !== 9) {
    errors.push('打順は9人で組んでください。')
  }

  const seen = new Set<string>()
  for (const [i, slot] of lineup.order.entries()) {
    const player = byId.get(slot.playerId)
    if (!player) {
      errors.push(`${i + 1}番打者が選ばれていません。`)
      continue
    }
    if (seen.has(slot.playerId)) errors.push(`${player.name}が打順に重複しています。`)
    seen.add(slot.playerId)
    if (benchOut.has(slot.playerId)) errors.push(`${player.name}はベンチ外です。`)
    if (slot.position !== 'DH' && !player.positions.includes(slot.position)) {
      errors.push(`${player.name}は${POSITION_NAME[slot.position]}を守れません。`)
    }
  }

  for (const pos of LINEUP_POSITIONS) {
    const count = lineup.order.filter((s) => s.position === pos).length
    if (count === 0) errors.push(`${POSITION_NAME[pos]}が決まっていません。`)
    if (count > 1) errors.push(`${POSITION_NAME[pos]}が${count}人います。`)
  }

  const starter = byId.get(lineup.startingPitcherId)
  if (!starter) {
    errors.push('先発投手を選んでください。')
  } else {
    if (!starter.pitching) errors.push(`${starter.name}は投手ではありません。`)
    if (seen.has(starter.id)) errors.push(`先発投手の${starter.name}が打順に入っています。`)
    if (benchOut.has(starter.id)) errors.push(`先発投手の${starter.name}はベンチ外です。`)
  }

  for (const id of lineup.bullpen) {
    const p = byId.get(id)
    if (!p) continue
    if (!p.pitching) errors.push(`${p.name}は投手ではありません。`)
    if (id === lineup.startingPitcherId) errors.push(`${p.name}は先発投手のため救援に入れません。`)
    if (benchOut.has(id)) errors.push(`${nameOf(id)}はベンチ外です。`)
  }

  const benchCount = team.roster.filter((p) => !benchOut.has(p.id)).length
  if (benchCount > rules.benchLimit) {
    errors.push(`ベンチ入りは${rules.benchLimit}人までです(現在${benchCount}人)。`)
  }
  return errors
}
