import type { BattingRatings, FieldingRatings, Hand, PitchingRatings } from '../domain/types'

export const APP_TITLE = 'プロ野球シミュレーター'

export const NAV_ITEMS = [
  { to: '/teams', label: 'チーム' },
  { to: '/game', label: '試合' },
  { to: '/records', label: '記録' },
] as const

export const HAND_LABEL: Record<Hand, string> = { R: '右', L: '左', S: '両' }

export const BATTING_LABEL: Record<keyof BattingRatings, string> = {
  contact: 'ミート',
  power: 'パワー',
  eye: '選球眼',
  speed: '走力',
}

export const FIELDING_LABEL: Record<keyof FieldingRatings, string> = {
  range: '守備範囲',
  arm: '肩力',
  hands: '捕球',
}

export const PITCHING_LABEL: Record<keyof PitchingRatings, string> = {
  stuff: '球威',
  control: '制球',
  stamina: 'スタミナ',
}
