import type { FieldPosition, Position } from './types'

export const FIELD_POSITIONS: FieldPosition[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']

/** Positions that must be filled in a DH-style batting order. */
export const LINEUP_POSITIONS: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']

/** 守備位置の略称 (投, 捕, 一 …). */
export const POSITION_SHORT: Record<Position, string> = {
  P: '投',
  C: '捕',
  '1B': '一',
  '2B': '二',
  '3B': '三',
  SS: '遊',
  LF: '左',
  CF: '中',
  RF: '右',
  DH: '指',
}

/** 守備位置の正式名 (ピッチャー, キャッチャー …). */
export const POSITION_NAME: Record<Position, string> = {
  P: 'ピッチャー',
  C: 'キャッチャー',
  '1B': 'ファースト',
  '2B': 'セカンド',
  '3B': 'サード',
  SS: 'ショート',
  LF: 'レフト',
  CF: 'センター',
  RF: 'ライト',
  DH: '指名打者',
}
