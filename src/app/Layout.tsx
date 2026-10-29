import { NavLink, Outlet } from 'react-router'
import { APP_TITLE, NAV_ITEMS } from './labels'
import './Layout.css'

export function Layout() {
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
        </div>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
    </div>
  )
}
