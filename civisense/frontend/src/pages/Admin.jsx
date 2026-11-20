import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtDate } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Empty, PageHead, Skeleton } from '../components.jsx'

export default function Admin() {
  const { user, ready } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '' })
  const [departments, setDepartments] = useState([])
  const [staff, setStaff] = useState([])
  const [log, setLog] = useState(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const loadLog = useCallback(() => { api.audit().then(setLog).catch((e) => { setError(e.message); setLog([]) }) }, [])
  const loadStaff = useCallback(() => { api.staff().then(setStaff).catch(() => {}) }, [])
  useEffect(() => { if (user?.role === 'admin') { loadLog(); loadStaff(); api.meta().then((m) => setDepartments(m.departments)).catch(() => {}) } }, [user, loadLog, loadStaff])

  if (!ready) return <Skeleton rows={2} />
  if (user?.role !== 'admin') {
    return (
      <div className="panel" style={{ maxWidth: 520 }}>
        <h2>Administrators only</h2>
        <p className="muted">Log in with the administrator account to manage staff and read the audit log.</p>
        <Link className="btn primary" to="/login">Log in</Link>
      </div>
    )
  }

  const create = async (e) => {
    e.preventDefault(); setError(''); setMsg('')
    try {
      const r = await api.createStaff(form.name, form.email, form.password, form.department)
      setMsg(`Staff account created for ${r.email}.`)
      setForm({ name: '', email: '', password: '', department: '' }); loadLog(); loadStaff()
    } catch (err) { setError(err.message) }
  }

  return (
    <>
      <PageHead title="Admin">Create staff accounts and review everything that changed.</PageHead>
      <div className="two-col">
        <form className="panel" onSubmit={create}>
          <h3>Create staff account</h3>
          <div className="field">
            <label className="field-label" htmlFor="sn">Name</label>
            <input id="sn" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="se">Email</label>
            <input id="se" className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="sp">Temporary password</label>
            <input id="sp" className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} autoComplete="new-password" />
            <span className="hint">At least 8 characters. Ask the person to keep it private.</span>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="sd">Department</label>
            <select id="sd" className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required>
              <option value="">Choose a department</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <span className="hint">This person approves jobs forwarded to this department, for example Public Works (Roads).</span>
          </div>
          {error && <p className="callout error" role="alert">{error}</p>}
          {msg && <p className="callout ok" role="status">{msg}</p>}
          <button className="btn primary">Create staff account</button>
        </form>

        <div>
          <h3>Staff and departments</h3>
          <p className="hint" style={{ marginBottom: 10 }}>An authority account without a department cannot approve any job. Set it here.</p>
          <div className="table-wrap" style={{ marginBottom: 24 }}>
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th></tr></thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td><td className="muted">{s.email}</td><td>{s.role}</td>
                    <td>{s.role === 'authority' ? (
                      <select className="input" aria-label={`Department for ${s.name}`} value={s.department || ''}
                              onChange={async (e) => { try { await api.setDepartment(s.id, e.target.value); loadStaff(); loadLog() } catch (err) { setError(err.message) } }}>
                        <option value="">Not set</option>
                        {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Audit log</h3>
          <p className="hint" style={{ marginBottom: 10 }}>Latest 100 entries: logins, failed logins, sign-ups, staff creation and every status change.</p>
          <div className="table-wrap">
            {log === null ? <div style={{ padding: 14 }}><Skeleton rows={3} /></div> : log.length === 0 ? <Empty title="No entries yet" /> : (
              <table className="table">
                <thead><tr><th>Time</th><th>Action</th><th>Role</th><th>Target</th><th>Detail</th><th>IP</th></tr></thead>
                <tbody>
                  {log.map((e, i) => (
                    <tr key={i}>
                      <td className="muted">{fmtDate(e.created_at)}</td><td>{e.action}</td><td>{e.actor_role || '-'}</td>
                      <td>{e.target || '-'}</td><td>{e.detail || '-'}</td><td className="muted">{e.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
