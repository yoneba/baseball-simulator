/**
 * Simulates many games between league-average teams and prints league rates,
 * to tune BASELINE in src/sim/model.ts against NPB-like targets.
 *
 * Usage: bun scripts/calibrate.ts [games]
 */
import { DEFAULT_LEAGUE_RULES } from '../src/domain/rules'
import type { Team } from '../src/domain/types'
import { buildBoxScore } from '../src/sim/boxscore'
import { createGame, simulateToEnd, type PAEvent } from '../src/sim/game'
import { createRng, randNormal, type Rng } from '../src/sim/rng'
import { makeTeam } from '../src/test/fixtures'

const GAMES = Number(process.argv[2] ?? 10000)

/** Spreads ratings around league average, with starters built for stamina. */
function averageTeam(prefix: string, rng: Rng): Team {
  const team = makeTeam(prefix)
  const r = () => Math.round(randNormal(rng, 50, 12, 1, 100))
  team.roster.forEach((p, i) => {
    if (p.pitching) {
      const starter = i === 13
      p.pitching = { stuff: r(), control: r(), stamina: starter ? Math.round(randNormal(rng, 80, 8, 1, 100)) : Math.round(randNormal(rng, 25, 6, 1, 100)) }
    } else {
      p.batting = { contact: r(), power: r(), eye: r(), speed: r() }
      p.fielding = { range: r(), arm: r(), hands: r() }
    }
  })
  return team
}

const rng = createRng(2026)
const t = { games: 0, runs: 0, pa: 0, ab: 0, h: 0, bb: 0, hbp: 0, k: 0, hr: 0, tb: 0, sf: 0, extra: 0, ties: 0, starterOuts: 0, pitches: 0 }
const TB = { '1B': 1, '2B': 2, '3B': 3, HR: 4 } as Record<string, number>

for (let i = 0; i < GAMES; i++) {
  const g = createGame({
    away: averageTeam('a', rng),
    home: averageTeam('h', rng),
    seed: Math.floor(rng.next() * 2 ** 32),
    rules: DEFAULT_LEAGUE_RULES.pacific,
    controllers: { away: 'cpu', home: 'cpu' },
  })
  simulateToEnd(g)
  t.games++
  t.runs += g.score.away + g.score.home
  if (g.inning > 9) t.extra++
  if (g.result === 'tie') t.ties++
  const box = buildBoxScore(g)
  t.starterOuts += box.pitching.away[0].outs + box.pitching.home[0].outs
  for (const e of g.events) {
    if (e.type !== 'pa') continue
    const pa = e as PAEvent
    t.pa++
    t.pitches += pa.pitches
    if (pa.outcome === 'BB') t.bb++
    else if (pa.outcome === 'HBP') t.hbp++
    else if (pa.special === 'SF') t.sf++
    else t.ab++
    if (pa.outcome === 'K') t.k++
    if (pa.outcome === 'HR') t.hr++
    if (pa.outcome in TB) {
      t.h++
      t.tb += TB[pa.outcome]
    }
  }
}

const teamGames = t.games * 2
const avg = t.h / t.ab
const obp = (t.h + t.bb + t.hbp) / (t.ab + t.bb + t.hbp + t.sf)
const slg = t.tb / t.ab
const rows: [string, string, string][] = [
  ['得点/試合(1チーム)', (t.runs / teamGames).toFixed(2), '3.3–3.9'],
  ['打率', avg.toFixed(3), '.240–.250'],
  ['出塁率', obp.toFixed(3), '.305–.320'],
  ['長打率', slg.toFixed(3), '.355–.380'],
  ['三振率', ((t.k / t.pa) * 100).toFixed(1) + '%', '19–21%'],
  ['四球率', ((t.bb / t.pa) * 100).toFixed(1) + '%', '7–9%'],
  ['本塁打/試合(1チーム)', (t.hr / teamGames).toFixed(2), '0.65–0.85'],
  ['先発投球回', (t.starterOuts / teamGames / 3).toFixed(2), '5.5–6.3'],
  ['球数/試合(1チーム)', (t.pitches / teamGames).toFixed(0), '135–150'],
  ['延長戦', ((t.extra / t.games) * 100).toFixed(1) + '%', '8–12%'],
  ['引き分け', ((t.ties / t.games) * 100).toFixed(1) + '%', '1–4%'],
]
console.log(`${t.games}試合をシミュレート`)
console.table(rows.map(([指標, 結果, 目標]) => ({ 指標, 結果, 目標 })))
