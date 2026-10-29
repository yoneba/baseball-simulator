import type { League } from '../domain/types'
import { pick, type Rng } from '../sim/rng'

export interface TeamSeed {
  id: string
  name: string
  shortName: string
  league: League
  color: string
}

const CITIES = ['札幌', '盛岡', '秋田', '山形', '水戸', '宇都宮', '前橋', '甲府', '長野', '富山', '福井', '岐阜', '津', '奈良', '和歌山', '鳥取', '松江', '山口', '徳島', '高松', '松山', '高知', '佐賀', '長崎', '大分', '宮崎', '鹿児島']
const NICKNAMES = ['サンダース', 'ペガサス', 'ウルブズ', 'グリフォンズ', 'オーシャンズ', 'フェニックス', 'ドルフィンズ', 'ファルコンズ', 'レンジャーズ', 'シャークス', 'ブリザード', 'コンドルズ', 'ジャガーズ', 'サムライズ', 'ニンジャズ', 'ハリケーンズ', 'ユニコーンズ']
const COLORS = ['#1d4ed8', '#b91c1c', '#15803d', '#7c3aed', '#c2410c', '#0f766e', '#be185d', '#4338ca', '#a16207', '#334155']

/** A random fictional city, nickname and color for a new team. */
export function randomTeamIdentity(rng: Rng): Pick<TeamSeed, 'name' | 'shortName' | 'color'> {
  const city = pick(rng, CITIES)
  return { name: `${city}${pick(rng, NICKNAMES)}`, shortName: city, color: pick(rng, COLORS) }
}
