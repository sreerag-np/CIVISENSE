import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

export default function Login() {
  const { login, register } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true)
    try {
      const u = mode === 'login' ? await login(email, password) : await register(name, email, password)
      nav(u.role === 'citizen' ? '/' : '/authority')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const isLogin = mode === 'login'

  return (
    <div className="auth">
      <div>
        <h1>{isLogin ? 'Welcome back.' : 'Join your neighbours.'}</h1>
        <p className="lede">Reporting works without an account. With one, you can:</p>
        <ul className="auth-list">
          <li>Support reports that affect you too</li>
          <li>Earn points on the civic leaderboard</li>
          <li>Staff accounts review and update reports</li>
        </ul>
      </div>

      <form className="panel" onSubmit={submit}>
        <div className="segmented" role="radiogroup" aria-label="Log in or create an account" style={{ marginBottom: 18, gridTemplateColumns: '1fr 1fr' }}>
          <button type="button" role="radio" aria-checked={isLogin} className={isLogin ? 'seg on' : 'seg'} onClick={() => { setMode('login'); setError('') }}>Log in</button>
          <button type="button" role="radio" aria-checked={!isLogin} className={!isLogin ? 'seg on' : 'seg'} onClick={() => { setMode('register'); setError('') }}>Create account</button>
        </div>
        {!isLogin && (
          <div className="field">
            <label className="field-label" htmlFor="nm">Name</label>
            <input id="nm" className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" />
          </div>
        )}
        <div className="field">
          <label className="field-label" htmlFor="em">Email</label>
          <input id="em" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="pw">Password</label>
          <input id="pw" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                 minLength={isLogin ? 1 : 8} autoComplete={isLogin ? 'current-password' : 'new-password'} />
          {!isLogin && <span className="hint">At least 8 characters.</span>}
        </div>
        {error && <p className="callout error" role="alert">{error}</p>}
        <button className="btn primary lg" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Please wait…' : isLogin ? 'Log in' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
