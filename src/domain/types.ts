export type League = 'central' | 'pacific'

export type Hand = 'R' | 'L' | 'S'

export type FieldPosition = 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF'
export type Position = FieldPosition | 'DH'

/** All ratings are 1–100, where 50 is league average. */
export interface BattingRatings {
  contact: number
  power: number
  eye: number
  speed: number
}

export interface FieldingRatings {
  range: number
  arm: number
  /** 捕球: higher means fewer errors. */
  hands: number
}

export interface PitchingRatings {
  stuff: number
  control: number
  stamina: number
}

export interface Player {
  id: string
  name: string
  /** 背番号, kept as text so that "00" and "0" are different numbers. */
  number: string
  bats: Hand
  throws: Exclude<Hand, 'S'>
  /** Positions the player can field. */
  positions: FieldPosition[]
  /** 外国人選手: counts toward the 外国人枠. */
  foreign: boolean
  batting: BattingRatings
  fielding: FieldingRatings
  pitching?: PitchingRatings
}

export interface LineupSlot {
  playerId: string
  position: Position
}

/**
 * A lineup is always written DH-style: nine batters including a DH, plus a
 * starting pitcher. When a game is played without the DH, the pitcher bats in
 * the DH's slot (see `resolveBattingOrder`).
 */
export interface Lineup {
  order: LineupSlot[]
  startingPitcherId: string
  /** Relievers in the order the manager prefers to use them. */
  bullpen: string[]
  /** 一軍 players left out of today's 26-man bench (ベンチ外). */
  benchOut: string[]
}

export interface Team {
  id: string
  name: string
  shortName: string
  league: League
  color: string
  /** 一軍登録選手. */
  roster: Player[]
  lineup: Lineup
}

export interface LeagueRules {
  dh: boolean
  regulationInnings: number
  /** 延長戦の上限. A game still tied after this inning ends as 引き分け. */
  maxInnings: number
  rosterLimit: number
  benchLimit: number
  foreignLimit: number
  /** Max foreign pitchers, and separately max foreign position players. */
  foreignPerRoleLimit: number
}
