import { describe, expect, test } from 'bun:test'
import { makeTeam } from '../test/fixtures'
import { DEFAULT_LEAGUE_RULES } from '../domain/rules'
import {
  defaultData,
  loadData,
  MAX_SAVED_GAMES,
  saveData,
  STORAGE_KEY,
  type AppData,
  type SavedGame,
} from './data'
import { storeReducer } from './reducer'
import { exportTeams, parseTeamsFile } from './transfer'

class MemoryStorage implements Storage {
  private items = new Map<string, string>()
  get length() {
    return this.items.size
  }
  clear() {
    this.items.clear()
  }
  getItem(key: string) {
    return this.items.get(key) ?? null
  }
  key(i: number) {
    return [...this.items.keys()][i] ?? null
  }
  removeItem(key: string) {
    this.items.delete(key)
  }
  setItem(key: string, value: string) {
    this.items.set(key, value)
  }
}

class FullStorage extends MemoryStorage {
  setItem(): void {
    throw new Error('QuotaExceededError')
  }
}

describe('persistence', () => {
  test('first visit seeds the 12 fictional teams', () => {
    const data = loadData(new MemoryStorage())
    expect(data.teams).toHaveLength(12)
    expect(data.savedGames).toEqual([])
  })

  test('round-trips through storage', () => {
    const storage = new MemoryStorage()
    const data = storeReducer(defaultData(), { type: 'deleteTeam', teamId: 'tokyo-mirages' })
    expect(saveData(data, storage)).toBe(true)
    expect(loadData(storage)).toEqual(data)
  })

  test('falls back to defaults on corrupt data or missing storage', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, '{not json')
    expect(loadData(storage).teams).toHaveLength(12)
    expect(loadData(null).teams).toHaveLength(12)
  })

  test('migrates numeric uniform numbers from version 1', () => {
    const storage = new MemoryStorage()
    const old = makeTeam('a')
    const v1 = { ...old, roster: old.roster.map((p) => ({ ...p, number: Number(p.number) })) }
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, teams: [v1] }))
    const data = loadData(storage)
    expect(data.schemaVersion).toBe(2)
    expect(data.teams[0].roster[0].number).toBe('1')
  })

  test('fills in missing fields from older data', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, teams: [] }))
    const data = loadData(storage)
    expect(data.teams).toEqual([])
    expect(data.leagueRules).toEqual(DEFAULT_LEAGUE_RULES)
  })

  test('reports failed saves', () => {
    expect(saveData(defaultData(), new FullStorage())).toBe(false)
    expect(saveData(defaultData(), null)).toBe(false)
  })
})

describe('storeReducer', () => {
  test('adds, updates and deletes teams', () => {
    let data: AppData = { ...defaultData(), teams: [] }
    const team = makeTeam('a')
    data = storeReducer(data, { type: 'upsertTeam', team })
    expect(data.teams).toHaveLength(1)
    data = storeReducer(data, { type: 'upsertTeam', team: { ...team, name: '新チーム' } })
    expect(data.teams).toHaveLength(1)
    expect(data.teams[0].name).toBe('新チーム')
    data = storeReducer(data, { type: 'deleteTeam', teamId: team.id })
    expect(data.teams).toEqual([])
  })

  test('changes league rules', () => {
    const data = storeReducer(defaultData(), {
      type: 'setLeagueRules',
      league: 'central',
      rules: { ...DEFAULT_LEAGUE_RULES.central, dh: false },
    })
    expect(data.leagueRules.central.dh).toBe(false)
    expect(data.leagueRules.pacific.dh).toBe(true)
  })

  test('keeps at most MAX_SAVED_GAMES, newest first', () => {
    let data = defaultData()
    for (let i = 0; i < MAX_SAVED_GAMES + 5; i++) {
      data = storeReducer(data, { type: 'addSavedGame', game: { id: `g${i}` } as SavedGame })
    }
    expect(data.savedGames).toHaveLength(MAX_SAVED_GAMES)
    expect(data.savedGames[0].id).toBe(`g${MAX_SAVED_GAMES + 4}`)
  })
})

describe('export/import', () => {
  test('round-trips teams with fresh ids', () => {
    const team = makeTeam('a')
    const [imported] = parseTeamsFile(exportTeams([team]))
    expect(imported.id).not.toBe(team.id)
    expect(imported.name).toBe(team.name)
    expect(imported.roster).toHaveLength(team.roster.length)
    const ids = new Set(imported.roster.map((p) => p.id))
    expect(ids.has(imported.lineup.startingPitcherId)).toBe(true)
    for (const s of imported.lineup.order) expect(ids.has(s.playerId)).toBe(true)
    for (const id of imported.lineup.bullpen) expect(ids.has(id)).toBe(true)
  })

  test('accepts files with numeric uniform numbers', () => {
    const file = JSON.parse(exportTeams([makeTeam('a')]))
    for (const p of file.teams[0].roster) p.number = Number(p.number)
    expect(parseTeamsFile(JSON.stringify(file))[0].roster[0].number).toBe('1')
  })

  test('rejects invalid files with Japanese messages', () => {
    expect(() => parseTeamsFile('nope')).toThrow('JSONとして読み込めませんでした。')
    expect(() => parseTeamsFile('{}')).toThrow('このアプリから書き出したファイルではありません。')
    const broken = JSON.parse(exportTeams([makeTeam('a')]))
    broken.teams[0].roster[0].batting.power = 500
    expect(() => parseTeamsFile(JSON.stringify(broken))).toThrow('1番目のチームのデータが壊れています。')
  })
})
