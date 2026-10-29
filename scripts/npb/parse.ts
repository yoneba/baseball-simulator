/** Parsers for NPB.jp roster and stats pages (2026 layout). */

export type RosterGroup = '投手' | '捕手' | '内野手' | '外野手'

export interface RosterEntry {
  number: string
  /** Surname and given name separated by a half-width space. */
  name: string
  group: RosterGroup
  throws: 'R' | 'L'
  bats: 'R' | 'L' | 'S'
}

const GROUPS: RosterGroup[] = ['投手', '捕手', '内野手', '外野手']
const HAND = { 右: 'R', 左: 'L', 両: 'S' } as const

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
}

function rows(html: string): string[][] {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((row) =>
    [...row[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((cell) => text(cell[1])),
  )
}

/** Stats pages prefix left-handed (*) and switch (+) players; names are matched without them or spaces. */
export function nameKey(name: string): string {
  return name.replace(/^[*+]/, '').replace(/[\s　]/g, '')
}

export function normalizeName(name: string): string {
  return name.replace(/^[*+]/, '').trim().replace(/[\s　]+/g, ' ')
}

/** 支配下選手 from a roster page (rst_*.html). 育成選手 and the manager are skipped. */
export function parseRoster(html: string): { teamName: string; players: RosterEntry[] } {
  const teamName = text(html.match(/class="tenametitle"><h1>([\s\S]*?)<\/h1>/)?.[1] ?? '')
  const registered = html.split(/<h3>■\s*育成選手<\/h3>/)[0]
  const players: RosterEntry[] = []
  let group: RosterGroup | null = null
  for (const cells of rows(registered)) {
    if (cells[0] === 'No.') {
      group = GROUPS.find((g) => g === cells[1]) ?? null
      continue
    }
    if (!group || cells.length < 7 || !/^\d{1,3}$/.test(cells[0])) continue
    const throws = HAND[cells[5] as keyof typeof HAND]
    const bats = HAND[cells[6] as keyof typeof HAND]
    if (!throws || !bats || throws === 'S') continue
    players.push({ number: cells[0], name: normalizeName(cells[1]), group, throws, bats })
  }
  return { teamName, players }
}

export type StatRow = Record<string, string>

function tableRows(html: string): StatRow[] {
  const all = rows(html)
  const header = all.find((r) => r[0] === '選手')
  if (!header) return []
  return all
    .filter((r) => r !== header && r.length === header.length && r[0] !== '選手')
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])))
}

/** 個人打撃成績 (idb1_*.html) or 個人投手成績 (idp1_*.html), keyed by nameKey. */
export function parseStats(html: string): Map<string, StatRow> {
  return new Map(tableRows(html).map((r) => [nameKey(r['選手']), r]))
}

/** 個人守備成績 (idf1_*.html): rows for each position section (一塁手, 外野手, 捕手 …). */
export function parseFielding(html: string): Map<string, StatRow[]> {
  const sections = new Map<string, StatRow[]>()
  const parts = html.split(/<h5>([^<]+)<\/h5>/)
  for (let i = 1; i < parts.length; i += 2) {
    const table = parts[i + 1].match(/<table[\s\S]*?<\/table>/)?.[0] ?? ''
    sections.set(parts[i].trim(), tableRows(table))
  }
  return sections
}

/** 投球回 such as "81.2" means 81 and 2/3 innings. Returns outs. */
export function inningsToOuts(ip: string): number {
  const [whole, frac = '0'] = ip.split('.')
  return Number(whole) * 3 + Number(frac)
}

/** Katakana-only names (e.g. ウィットリー, マイク・ジョンソン) are treated as 外国人選手. */
export function looksForeign(name: string): boolean {
  return /^[゠-ヿ・ー\s]+$/.test(name)
}
