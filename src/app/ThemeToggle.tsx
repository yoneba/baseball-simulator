import { useState } from 'react'

type Theme = 'system' | 'light' | 'dark'

const KEY = 'bbsim:theme'
const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
const LABEL: Record<Theme, string> = { system: '自動', light: 'ライト', dark: 'ダーク' }

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

function applyTheme(theme: Theme): void {
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}

/** Switches between the system theme and forced light or dark, remembered per browser. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    const t = readTheme()
    applyTheme(t)
    return t
  })

  const cycle = () => {
    const next = NEXT[theme]
    setTheme(next)
    applyTheme(next)
    try {
      if (next === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, next)
    } catch {
      // Storage unavailable: the choice lasts for this visit only.
    }
  }

  return (
    <button className="theme-toggle" onClick={cycle} aria-label={`表示テーマ: ${LABEL[theme]}(クリックで切り替え)`}>
      {theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'} {LABEL[theme]}
    </button>
  )
}
