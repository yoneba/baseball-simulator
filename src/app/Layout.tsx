import { NavLink, Outlet } from 'react-router'
import { useStore } from '../store/context'
import { APP_TITLE, NAV_ITEMS } from './labels'
import { ThemeToggle } from './ThemeToggle'
import './Layout.css'

export function Layout() {
  const { saveFailed } = useStore()
  return (
    <div className="layout">
      <header className="site-header">
        <div className="site-header-inner">
          <NavLink to="/" className="brand">
            ⚾ {APP_TITLE}
          </NavLink>
          <nav className="site-nav" aria-label="メインメニュー">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main className="site-main">
        {saveFailed && (
          <p className="error-list" role="alert">
            データを保存できませんでした。ブラウザの設定を確認するか、チームを書き出して保管してください。
          </p>
        )}
        <Outlet />
      </main>
    </div>
  )
}
