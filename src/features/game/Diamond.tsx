import type { Bases } from '../../sim/baserunning'

/** Bases (filled when occupied) and the アウトカウント. */
export function Diamond({ bases, outs }: { bases: Bases; outs: number }) {
  const base = (x: number, y: number, on: boolean, label: string) => (
    <rect
      x={x - 9}
      y={y - 9}
      width={18}
      height={18}
      transform={`rotate(45 ${x} ${y})`}
      className={on ? 'base on' : 'base'}
    >
      <title>{`${label}${on ? ': 走者あり' : ''}`}</title>
    </rect>
  )
  const occupied = bases.map(Boolean)
  const runnerText = ['一塁', '二塁', '三塁'].filter((_, i) => occupied[i]).join('・')

  return (
    <div className="diamond">
      <svg viewBox="0 0 100 80" role="img" aria-label={runnerText ? `走者 ${runnerText}` : '走者なし'}>
        {base(50, 16, occupied[1], '二塁')}
        {base(80, 44, occupied[0], '一塁')}
        {base(20, 44, occupied[2], '三塁')}
        <path d="M50 66 l7 -7 v-6 h-14 v6 z" className="home-plate" />
      </svg>
      <div className="outs" aria-label={`${outs}アウト`}>
        <span className="muted small">アウト</span>
        {[0, 1].map((i) => (
          <span key={i} className={i < outs ? 'out-dot on' : 'out-dot'} />
        ))}
      </div>
    </div>
  )
}
