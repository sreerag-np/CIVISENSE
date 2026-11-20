import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import { useAuth } from './auth.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import ThemeMenu from './ThemeMenu.jsx'
import Home from './pages/Home.jsx'
import Report from './pages/Report.jsx'
import Explore from './pages/Explore.jsx'
import Track from './pages/Track.jsx'
import Authority from './pages/Authority.jsx'
import Analytics from './pages/Analytics.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import Admin from './pages/Admin.jsx'
import Login from './pages/Login.jsx'

function BrandMark() {
  // Two road-centreline dashes on asphalt.
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 18 18"><rect x="7.5" y="1" width="3" height="6" rx="1.2" fill="var(--accent)" /><rect x="7.5" y="11" width="3" height="6" rx="1.2" fill="var(--accent)" /></svg>
    </span>
  )
}

export default function App() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const isStaff = user && (user.role === 'authority' || user.role === 'admin')

  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [pathname])

  const links = [
    ['/explore', 'Map'], ['/track', 'Track'], ['/leaderboard', 'Leaderboard'], ['/analytics', 'Analytics'],
    ...(isStaff ? [['/authority', 'Authority centre']] : []),
    ...(user?.role === 'admin' ? [['/admin', 'Admin']] : []),
  ]

  return (
    <div className="app">
      <a className="skip" href="#main">Skip to content</a>
      <header className={open ? 'topbar open' : 'topbar'}>
        <div className="wrap topbar-in">
          <Link to="/" className="brand"><BrandMark /> CIVISENSE</Link>
          <nav className="nav" aria-label="Main">
            {links.map(([to, label]) => <NavLink key={to} to={to} className="nav-link">{label}</NavLink>)}
            <Link to="/report" className="nav-link nav-mobile-only">Report an issue</Link>
            {user
              ? <button type="button" className="nav-link nav-mobile-only nav-btn" onClick={logout}>Log out</button>
              : <Link to="/login" className="nav-link nav-mobile-only">Log in</Link>}
          </nav>
          <div className="topbar-actions">
            <Link to="/report" className="btn primary topbar-report">Report an issue</Link>
            <ThemeMenu />
            {user ? (
              <>
                <span className="user-chip" title={user.email}>
                  <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
                  <span className="user-name">{user.name}</span>
                </span>
                <button className="icon-btn topbar-logout" onClick={logout} aria-label="Log out" title="Log out"><LogOut size={18} /></button>
              </>
            ) : (
              <Link to="/login" className="btn topbar-login">Log in</Link>
            )}
            <button className="icon-btn menu-btn" onClick={() => setOpen(!open)} aria-expanded={open}
                    aria-label={open ? 'Close menu' : 'Open menu'}>
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="wrap page">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/report" element={<Report />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/track" element={<Track />} />
            <Route path="/track/:ref" element={<Track />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/authority" element={<Authority />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<p>That page does not exist. <Link to="/">Go to the home page</Link>.</p>} />
          </Routes>
        </ErrorBoundary>
      </main>
      <footer className="foot">
        <div className="wrap">
          CIVISENSE is a prototype and not an official government service. In an emergency, call your local emergency number.
        </div>
      </footer>
    </div>
  )
}
