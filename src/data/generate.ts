import { autoLineup } from '../domain/autoLineup'
import type { FieldPosition, Hand, Player, Team } from '../domain/types'
import { chance, createRng, pick, randNormal, type Rng } from '../sim/rng'
import { FOREIGN_GIVEN_NAMES, FOREIGN_SURNAMES, GIVEN_NAMES, SURNAMES } from './names'
import { TEAM_SEEDS, type TeamSeed } from './teams'

export type PlayerRole = 'SP' | 'RP' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'OF'

export const ROLE_LABEL: Record<PlayerRole, string> = {
  SP: '先発投手',
  RP: '救援投手',
  C: '捕手',
  '1B': '一塁手',
  '2B': '二塁手',
  '3B': '三塁手',
  SS: '遊撃手',
  OF: '外野手',
}

/** 31-man 一軍: 15 pitchers and 16 position players. */
const ROSTER_ROLES: PlayerRole[] = [
  ...Array<PlayerRole>(6).fill('SP'),
  ...Array<PlayerRole>(9).fill('RP'),
  ...Array<PlayerRole>(3).fill('C'),
  '1B', '1B', '2B', '2B', '3B', 'SS', 'SS',
  ...Array<PlayerRole>(6).fill('OF'),
]

/** Indexes into ROSTER_ROLES of the 外国人選手: an SP, an RP, a 1B and an OF. */
const FOREIGN_SLOTS = new Set([0, 6, 18, 25])

const rating = (rng: Rng, mean = 50, sd = 13) => Math.round(randNormal(rng, mean, sd, 1, 99))

function hand(rng: Rng, allowSwitch: boolean): Hand {
  const r = rng.next()
  if (allowSwitch && r < 0.05) return 'S'
  return r < 0.38 ? 'L' : 'R'
}

function positionsFor(rng: Rng, role: PlayerRole): FieldPosition[] {
  switch (role) {
    case 'SP':
    case 'RP':
      return ['P']
    case 'C':
      return chance(rng, 0.2) ? ['C', '1B'] : ['C']
    case '1B':
      return chance(rng, 0.3) ? ['1B', pick(rng, ['3B', 'LF'] as const)] : ['1B']
    case '2B':
      return ['2B', ...(chance(rng, 0.4) ? (['SS'] as const) : []), ...(chance(rng, 0.3) ? (['3B'] as const) : [])]
    case '3B':
      return chance(rng, 0.4) ? ['3B', '1B'] : ['3B']
    case 'SS':
      return ['SS', ...(chance(rng, 0.6) ? (['2B'] as const) : []), ...(chance(rng, 0.3) ? (['3B'] as const) : [])]
    case 'OF':
      return chance(rng, 0.45) ? ['CF', 'LF', 'RF'] : chance(rng, 0.3) ? ['LF', 'RF', '1B'] : ['LF', 'RF']
  }
}

export interface GenerateOptions {
  id: string
  number: string
  foreign?: boolean
  /** Surnames already on the team, to keep broadcast names unambiguous. */
  usedSurnames?: Set<string>
}

function generateName(rng: Rng, foreign: boolean, used?: Set<string>): string {
  const surnames = foreign ? FOREIGN_SURNAMES : SURNAMES
  let surname = pick(rng, surnames)
  for (let i = 0; i < 20 && used?.has(surname); i++) surname = pick(rng, surnames)
  used?.add(surname)
  return foreign ? `${pick(rng, FOREIGN_GIVEN_NAMES)}・${surname}` : `${surname} ${pick(rng, GIVEN_NAMES)}`
}

/** Generates a fictional player for a role. Ratings center on league average (50). */
export function generatePlayer(rng: Rng, role: PlayerRole, opts: GenerateOptions): Player {
  const foreign = opts.foreign ?? false
  const isPitcher = role === 'SP' || role === 'RP'
  const positions = positionsFor(rng, role)
  const premium = role === 'SS' || role === '2B' || positions.includes('CF')
  const corner = role === '1B' || (role === 'OF' && !positions.includes('CF'))
  const mustThrowRight = role === 'C' || role === '2B' || role === '3B' || role === 'SS'
  const bats = hand(rng, !isPitcher)

  const player: Player = {
    id: opts.id,
    name: generateName(rng, foreign, opts.usedSurnames),
    number: opts.number,
    bats,
    throws: mustThrowRight ? 'R' : chance(rng, 0.28) ? 'L' : 'R',
    positions,
    foreign,
    batting: isPitcher
      ? { contact: rating(rng, 15, 6), power: rating(rng, 10, 6), eye: rating(rng, 15, 6), speed: rating(rng, 35, 10) }
      : {
          contact: rating(rng, role === 'C' ? 45 : 50),
          power: rating(rng, (corner ? 56 : premium ? 44 : 50) + (foreign ? 12 : 0)),
          eye: rating(rng),
          speed: rating(rng, (premium ? 56 : role === 'C' ? 38 : 50) - (foreign ? 5 : 0)),
        },
    fielding: {
      range: rating(rng, premium ? 58 : corner ? 45 : 50),
      arm: rating(rng, role === 'C' || role === 'SS' ? 56 : 50),
      hands: rating(rng),
    },
  }
  if (isPitcher) {
    player.pitching = {
      stuff: rating(rng, foreign ? 56 : 50),
      control: rating(rng),
      stamina: role === 'SP' ? Math.round(randNormal(rng, 80, 8, 55, 99)) : Math.round(randNormal(rng, 25, 6, 10, 45)),
    }
  }
  return player
}

/** Generates a full 31-man team with 4 foreign players and an automatic lineup. */
export function generateTeam(rng: Rng, seed: TeamSeed): Team {
  const numbers = Array.from({ length: 100 }, (_, i) => i)
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[numbers[i], numbers[j]] = [numbers[j], numbers[i]]
  }
  const usedSurnames = new Set<string>()
  const roster = ROSTER_ROLES.map((role, i) =>
    generatePlayer(rng, role, {
      id: `${seed.id}-${i + 1}`,
      number: String(numbers[i]),
      foreign: FOREIGN_SLOTS.has(i),
      usedSurnames,
    }),
  )
  return { ...seed, roster, lineup: autoLineup({ roster }) }
}

/** The 12 fictional teams of the default league. */
export function generateDefaultTeams(seed = 2026): Team[] {
  const rng = createRng(seed)
  return TEAM_SEEDS.map((s) => generateTeam(rng, s))
}
