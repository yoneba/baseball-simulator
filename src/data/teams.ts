import type { League } from '../domain/types'
import { pick, type Rng } from '../sim/rng'

export interface TeamSeed {
  id: string
  name: string
  shortName: string
  league: League
  color: string
}

/** Fictional teams shipped with the app, six per league. */
export const TEAM_SEEDS: TeamSeed[] = [
  { id: 'tokyo-mirages', name: '東京ミラージュ', shortName: '東京', league: 'central', color: '#1f3a93' },
  { id: 'yokohama-seagulls', name: '横浜シーガルズ', shortName: '横浜', league: 'central', color: '#0284c7' },
  { id: 'nagoya-blaze', name: '名古屋ブレイズ', shortName: '名古屋', league: 'central', color: '#ea580c' },
  { id: 'kanazawa-lightning', name: '金沢ライトニング', shortName: '金沢', league: 'central', color: '#7c3aed' },
  { id: 'shizuoka-stellars', name: '静岡ステラーズ', shortName: '静岡', league: 'central', color: '#059669' },
  { id: 'okayama-red-owls', name: '岡山レッドオウルズ', shortName: '岡山', league: 'central', color: '#dc2626' },
  { id: 'hakodate-northerns', name: '函館ノーザンズ', shortName: '函館', league: 'pacific', color: '#0f766e' },
  { id: 'niigata-snow-foxes', name: '新潟スノーフォックス', shortName: '新潟', league: 'pacific', color: '#475569' },
  { id: 'kyoto-golden-cranes', name: '京都ゴールデンクレインズ', shortName: '京都', league: 'pacific', color: '#ca8a04' },
  { id: 'kobe-comets', name: '神戸コメッツ', shortName: '神戸', league: 'pacific', color: '#2563eb' },
  { id: 'kumamoto-volcanoes', name: '熊本ボルケーノズ', shortName: '熊本', league: 'pacific', color: '#b91c1c' },
  { id: 'okinawa-shisas', name: '沖縄シーサーズ', shortName: '沖縄', league: 'pacific', color: '#16a34a' },
]

const CITIES = ['札幌', '盛岡', '秋田', '山形', '水戸', '宇都宮', '前橋', '甲府', '長野', '富山', '福井', '岐阜', '津', '奈良', '和歌山', '鳥取', '松江', '山口', '徳島', '高松', '松山', '高知', '佐賀', '長崎', '大分', '宮崎', '鹿児島']
const NICKNAMES = ['サンダース', 'ペガサス', 'ウルブズ', 'グリフォンズ', 'オーシャンズ', 'フェニックス', 'ドルフィンズ', 'ファルコンズ', 'レンジャーズ', 'シャークス', 'ブリザード', 'コンドルズ', 'ジャガーズ', 'サムライズ', 'ニンジャズ', 'ハリケーンズ', 'ユニコーンズ']
const COLORS = ['#1d4ed8', '#b91c1c', '#15803d', '#7c3aed', '#c2410c', '#0f766e', '#be185d', '#4338ca', '#a16207', '#334155']

/** A random fictional city, nickname and color for a new team. */
export function randomTeamIdentity(rng: Rng): Pick<TeamSeed, 'name' | 'shortName' | 'color'> {
  const city = pick(rng, CITIES)
  return { name: `${city}${pick(rng, NICKNAMES)}`, shortName: city, color: pick(rng, COLORS) }
}
