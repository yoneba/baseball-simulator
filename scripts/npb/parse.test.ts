import { describe, expect, test } from 'bun:test'
import { inningsToOuts, looksForeign, nameKey, parseFielding, parseRoster, parseStats } from './parse'
import { regress, scaleRatings, stamina, toRating } from './ratings'

const ROSTER = `
<td class="tenametitle"><h1>テスト球団</h1></td>
<h3>■ 支配下選手</h3>
<table>
<tr class="rosterMainHead"><th>No.</th><th><a name="#">監督</a></th><th>生年月日</th></tr>
<tr class="rosterPlayer"><td>83</td><td>監督　太郎</td><td>1979.03.20</td><td colspan="4"><br /></td><td><br /></td></tr>
<tr class="rosterMainHead"><th>No.</th><th><a name="pit">投手</a></th><th>生年月日</th><th>身長</th><th>体重</th><th>投</th><th>打</th><th>備考</th></tr>
<tr class="rosterPlayer"><td>11</td><td><a href="/x.html">田中　将大</a></td><td>1988.11.01</td><td>188</td><td>102</td><td>右</td><td>右</td><td><br /></td></tr>
<tr class="rosterMainHead"><th>No.</th><th><a name="inf">内野手</a></th><th>生年月日</th><th>身長</th><th>体重</th><th>投</th><th>打</th><th>備考</th></tr>
<tr class="rosterPlayer"><td>00</td><td>ダルベック</td><td>1995.01.01</td><td>190</td><td>100</td><td>右</td><td>両</td><td><br /></td></tr>
</table>
<h3>■ 育成選手</h3>
<table><tr class="rosterPlayer"><td>011</td><td>育成　選手</td><td>2000.01.01</td><td>180</td><td>80</td><td>右</td><td>右</td><td></td></tr></table>
`

describe('parseRoster', () => {
  test('reads 支配下 players with groups and handedness, skipping the manager and 育成', () => {
    const { teamName, players } = parseRoster(ROSTER)
    expect(teamName).toBe('テスト球団')
    expect(players).toEqual([
      { number: '11', name: '田中 将大', group: '投手', throws: 'R', bats: 'R' },
      { number: '00', name: 'ダルベック', group: '内野手', throws: 'R', bats: 'S' },
    ])
  })
})

describe('stats pages', () => {
  test('parseStats keys rows by name without handedness marks or spaces', () => {
    const html = `<table><tr><th>選手</th><th>打席</th></tr><tr><td>*泉口　友汰</td><td>524</td></tr></table>`
    expect(parseStats(html).get('泉口友汰')).toEqual({ 選手: '*泉口　友汰', 打席: '524' })
  })

  test('parseFielding splits position sections', () => {
    const html = `<h5>一塁手</h5><table><tr><th>選手</th><th>試合</th></tr><tr><td>A</td><td>10</td></tr></table>
      <h5>捕手</h5><table><tr><th>選手</th><th>試合</th></tr><tr><td>B</td><td>90</td></tr></table>`
    const sections = parseFielding(html)
    expect(sections.get('一塁手')).toEqual([{ 選手: 'A', 試合: '10' }])
    expect(sections.get('捕手')).toEqual([{ 選手: 'B', 試合: '90' }])
  })

  test('helpers', () => {
    expect(nameKey('+石川　達也')).toBe('石川達也')
    expect(inningsToOuts('81.2')).toBe(245)
    expect(inningsToOuts('147')).toBe(441)
    expect(looksForeign('ウィットリー')).toBe(true)
    expect(looksForeign('マイク・ジョンソン')).toBe(true)
    expect(looksForeign('田中 将大')).toBe(false)
    expect(looksForeign('大勢')).toBe(false)
  })
})

describe('ratings', () => {
  test('regress shrinks small samples toward the mean', () => {
    expect(regress(0.4, 10, 0.25, 200)).toBeCloseTo(0.257, 3)
    expect(regress(0.4, 2000, 0.25, 200)).toBeCloseTo(0.386, 3)
  })

  test('toRating maps z-scores to 1–99', () => {
    expect(toRating(0)).toBe(50)
    expect(toRating(1)).toBe(65)
    expect(toRating(10)).toBe(99)
    expect(toRating(-10)).toBe(1)
  })

  test('scaleRatings standardizes against regulars', () => {
    const regulars = [{ a: -1 }, { a: 0 }, { a: 1 }]
    expect(scaleRatings([{ a: 0 }, { a: 2 }], regulars).map((r) => r.a)).toEqual([50, 87])
  })

  test('stamina follows innings per appearance', () => {
    const starter = stamina({ bf: 600, outs: 450, games: 25, k: 0, bb: 0, hr: 0 })
    const reliever = stamina({ bf: 220, outs: 165, games: 55, k: 0, bb: 0, hr: 0 })
    expect(starter).toBeGreaterThanOrEqual(80)
    expect(reliever).toBeLessThan(50)
  })
})
