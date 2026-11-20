import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtDate } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Empty, PageHead, RiskBadge, SampleTag, Skeleton, SlaTag, StatusBadge, TierBadge } from '../components.jsx'

const RISKS = [['high', 'High risk'], ['medium', 'Medium risk'], ['low', 'Low risk']]

// Administrator tabs: each one is a stage of the approval workflow.
const ADMIN_TABS = [
  ['triage', 'To triage', ['submitted', 'under_review']],
  ['dept', 'With department', ['forwarded']],
  ['approved', 'Approved: send message', ['approved']],
  ['active', 'Active work', ['assigned', 'in_progress']],
  ['closed', 'Closed', ['resolved', 'rejected']],
]
const AUTH_TABS = [
  ['dept', 'Waiting for my approval', ['forwarded']],
  ['active', 'Active work', ['assigned', 'in_progress']],
  ['other', 'Approved, awaiting message', ['approved']],
  ['closed', 'Closed', ['resolved', 'rejected']],
]

const defaultMessage = (r) =>
  `Your report ${r.ref} has been approved by ${r.department}. ${r.workers} workers have been assigned and the work will start soon.`

export default function Authority() {
  const { user, ready } = useAuth()
  const isAdmin = user?.role === 'admin'
  const tabs = isAdmin ? ADMIN_TABS : AUTH_TABS
  const [tab, setTab] = useState(isAdmin ? 'triage' : 'dept')
  const [departments, setDepartments] = useState([])
  const [q, setQ] = useState('')
  const [reports, setReports] = useState(null)
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [triage, setTriage] = useState({ risk: 'medium', department: '', authority: '', workers: '', note: '' })
  const [decision, setDecision] = useState({ note: '' })
  const [assignMsg, setAssignMsg] = useState('')
  const [step, setStep] = useState({ note: '' })

  const load = useCallback(() => {
    api.reports({ q, sort: 'priority' }).then(setReports).catch((e) => { setError(e.message); setReports([]) })
  }, [q])

  useEffect(() => { api.meta().then((m) => setDepartments(m.departments)).catch(() => {}) }, [])
  useEffect(() => { if (user) setTab(user.role === 'admin' ? 'triage' : 'dept') }, [user])
  useEffect(() => { if (user) load() }, [user, load])

  if (!ready) return <Skeleton rows={2} />
  if (!user || !['authority', 'admin'].includes(user.role)) {
    return (
      <div className="panel" style={{ maxWidth: 520 }}>
        <h2>Staff only</h2>
        <p className="muted">The authority centre is for authorised staff. Log in with a staff account to review reports.</p>
        <Link className="btn primary" to="/login">Log in</Link>
      </div>
    )
  }

  const list = reports || []
  const tabStatuses = tabs.find((t) => t[0] === tab)[2]
  // An authority account only sees jobs for its own department.
  const mine = (r) => isAdmin || !['forwarded', 'assigned', 'in_progress'].includes(r.status) || (!!user.department && r.department === user.department)
  const visible = list.filter((r) => tabStatuses.includes(r.status) && mine(r))
  const counts = Object.fromEntries(tabs.map(([k, , st]) => [k, list.filter((r) => st.includes(r.status) && mine(r)).length]))
  const overdue = list.filter((r) => r.overdue).length

  const open = async (ref) => {
    setMsg(''); setError('')
    try {
      const r = await api.report(ref)
      setSelected(r)
      setTriage({ risk: r.risk, department: r.department || '', authority: '', workers: '', note: '' })
      setDecision({ note: '' }); setStep({ note: '' })
      setAssignMsg(defaultMessage(r))
    } catch (e) { setError(e.message) }
  }
  const run = async (fn, done) => {
    setError(''); setMsg('')
    try { await fn(); setMsg(done); await open(selected.ref); load() } catch (e) { setError(e.message) }
  }

  const s = selected
  const suggested = s?.suggested_workers
  const deptMatches = s && !isAdmin && user.department && s.department === user.department

  return (
    <>
      <PageHead title="Authority centre">
        {isAdmin
          ? 'Triage each report, send it to the concerned department, then tell the citizen once the department approves. Most critical jobs come first.'
          : `Jobs forwarded to ${user.department || 'your department (ask an administrator to set it)'}. Most critical first.`}
      </PageHead>

      <div className="figures">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" className="figure figure-btn" aria-pressed={tab === k} onClick={() => setTab(k)}>
            <div className="figure-value">{counts[k]}</div><div className="figure-label">{label}</div>
          </button>
        ))}
        <div className="figure"><div className="figure-value" style={{ color: overdue ? 'var(--danger)' : undefined }}>{overdue}</div><div className="figure-label">Past response target</div></div>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <input className="input grow" style={{ maxWidth: 360 }} aria-label="Search reports" placeholder="Search text or reference" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p className="callout error" role="alert">{error}</p>}
      {!isAdmin && !user.department && <p className="callout warn">Your account has no department yet, so you cannot approve jobs. Ask an administrator to set it.</p>}

      <div className="review">
        <div className="table-wrap">
          {reports === null ? <div style={{ padding: 14 }}><Skeleton rows={4} /></div> : visible.length === 0 ? (
            <Empty title="Nothing here">Reports move between tabs as they pass each stage.</Empty>
          ) : (
            <table className="table">
              <thead><tr><th>Reference</th><th>Category</th><th>Risk</th><th>CHI</th><th>Workers</th><th>Status</th><th>Target</th></tr></thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.ref} className={selected?.ref === r.ref ? 'clickable sel' : 'clickable'} onClick={() => open(r.ref)}
                      tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') open(r.ref) }}>
                    <td><span className="ref" style={{ fontSize: '1rem' }}>{r.ref}</span><SampleTag show={r.is_sample} /></td>
                    <td>{r.category_label}<div className="muted small">{r.department}</div></td>
                    <td><RiskBadge risk={r.risk} /></td>
                    <td><TierBadge tier={r.tier} chi={r.chi} /></td>
                    <td>{r.workers ?? `${r.suggested_workers} (suggested)`}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td><SlaTag report={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <aside className="panel review-side" aria-label="Report review">
          {!s ? <p className="muted">Select a report from the list.</p> : (
            <>
              <h3>{s.category_label} <RiskBadge risk={s.risk} /></h3>
              <p>{s.description}</p>
              {s.image_url && <img src={s.image_url} alt="Photo attached to the report" style={{ borderRadius: 8, maxHeight: 240 }} />}
              <p className="hint">
                {s.authority || 'Needs manual routing'}. {s.routing_note} Suggestion by {s.ai_method || 'n/a'}
                {s.ai_confidence != null && ` (${Math.round(s.ai_confidence * 100)}% confidence)`}.
              </p>
              {s.duplicate_of_ref && <p className="callout warn">Likely duplicate of {s.duplicate_of_ref}. Check before forwarding.</p>}
              <p><StatusBadge status={s.status} /> {s.department && <span className="muted small">{s.department}</span>}</p>

              {/* Administrator: triage and forward */}
              {isAdmin && ['submitted', 'under_review'].includes(s.status) && (
                <form onSubmit={(e) => { e.preventDefault(); run(() => api.forward(s.ref, {
                  risk: triage.risk, department: triage.department, authority: triage.authority || null,
                  workers: triage.workers ? Number(triage.workers) : null, note: triage.note }), 'Forwarded to the department.') }}>
                  <h4>Triage and forward</h4>
                  <div className="field">
                    <span className="field-label" id="risk-l">Risk level</span>
                    <div className="chips" role="radiogroup" aria-labelledby="risk-l">
                      {RISKS.map(([v, l]) => (
                        <button key={v} type="button" role="radio" aria-checked={triage.risk === v} className="chip" onClick={() => setTriage({ ...triage, risk: v })}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="dep">Concerned department</label>
                    <select id="dep" className="input" required value={triage.department} onChange={(e) => setTriage({ ...triage, department: e.target.value })}>
                      <option value="">Choose a department</option>
                      {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="wk">Number of workers</label>
                    <input id="wk" className="input" type="number" min={1} max={50} value={triage.workers} onChange={(e) => setTriage({ ...triage, workers: e.target.value })}
                           placeholder={`Default for ${triage.risk} risk: leave empty`} />
                    <span className="hint">Left empty, the system uses 6 for high, 4 for medium and 2 for low risk, plus 2 when the hazard index is critical (currently suggests {suggested}).</span>
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="nt">Internal note</label>
                    <textarea id="nt" className="input" rows={2} required minLength={3} maxLength={500} value={triage.note} onChange={(e) => setTriage({ ...triage, note: e.target.value })} />
                    <span className="hint">Seen by staff only, not by the citizen.</span>
                  </div>
                  <div className="row">
                    <button className="btn primary" disabled={!triage.department}>Forward to {triage.department || 'department'}</button>
                    {s.status === 'submitted' && (
                      <button type="button" className="btn" onClick={() => run(() => api.updateStatus(s.ref, { status: 'under_review', note: triage.note.length >= 3 ? triage.note : 'Review started.' }), 'Marked under review.')}>Start review only</button>
                    )}
                    <button type="button" className="btn" onClick={() => run(() => api.updateStatus(s.ref, { status: 'rejected', note: triage.note }), 'Report rejected.')} disabled={triage.note.trim().length < 3}>Reject</button>
                  </div>
                  <span className="hint">Reject sends the internal note to the citizen as the reason.</span>
                </form>
              )}

              {/* Department authority: approve or decline */}
              {s.status === 'forwarded' && !isAdmin && (
                deptMatches ? (
                  <div>
                    <h4>Approve this job?</h4>
                    <p className="hint">Administrator asked for {s.workers} workers, {s.risk} risk.</p>
                    <div className="field">
                      <label className="field-label" htmlFor="dn">Internal note</label>
                      <textarea id="dn" className="input" rows={2} maxLength={500} value={decision.note} onChange={(e) => setDecision({ note: e.target.value })} />
                    </div>
                    <div className="row">
                      <button className="btn primary" disabled={decision.note.trim().length < 3} onClick={() => run(() => api.review(s.ref, { decision: 'approve', note: decision.note }), 'Job approved. The administrator will now message the citizen.')}>Approve job</button>
                      <button className="btn" disabled={decision.note.trim().length < 3} onClick={() => run(() => api.review(s.ref, { decision: 'decline', note: decision.note }), 'Job declined and returned to the administrator.')}>Decline</button>
                    </div>
                  </div>
                ) : <p className="callout warn">This job was forwarded to {s.department}. Only that department can approve it.</p>
              )}
              {s.status === 'forwarded' && isAdmin && <p className="callout">Waiting for {s.department} to approve. Only they can approve it.</p>}

              {/* Administrator: send assigned message */}
              {s.status === 'approved' && isAdmin && (
                <form onSubmit={(e) => { e.preventDefault(); run(() => api.assign(s.ref, assignMsg), 'Assigned message sent to the citizen.') }}>
                  <h4>Send assigned message</h4>
                  <p className="hint">{s.department} approved this job. This message appears on the citizen's Track page.</p>
                  <textarea className="input" rows={4} required minLength={3} maxLength={500} aria-label="Message to the citizen" value={assignMsg} onChange={(e) => setAssignMsg(e.target.value)} />
                  <button className="btn primary" style={{ marginTop: 8 }}>Send assigned message to citizen</button>
                </form>
              )}
              {s.status === 'approved' && !isAdmin && <p className="callout">Approved. Only the administrator sends the assigned message to the citizen.</p>}

              {/* Work steps */}
              {['assigned', 'in_progress'].includes(s.status) && (isAdmin || deptMatches) && (
                <div>
                  <h4>Work progress</h4>
                  <textarea className="input" rows={2} maxLength={500} aria-label="Progress note shown to the citizen" placeholder="Progress note (shown to the citizen)" value={step.note} onChange={(e) => setStep({ note: e.target.value })} />
                  <div className="row" style={{ marginTop: 8 }}>
                    {s.status === 'assigned' && <button className="btn" disabled={step.note.trim().length < 3} onClick={() => run(() => api.updateStatus(s.ref, { status: 'in_progress', note: step.note }), 'Work started.')}>Start work</button>}
                    <button className="btn primary" disabled={step.note.trim().length < 3} onClick={() => run(() => api.updateStatus(s.ref, { status: 'resolved', note: step.note }), 'Marked resolved.')}>Mark resolved</button>
                  </div>
                </div>
              )}

              {['resolved', 'rejected'].includes(s.status) && (isAdmin
                ? <button className="btn" onClick={() => run(() => api.updateStatus(s.ref, { status: 'under_review', note: 'Reopened by administrator.' }), 'Reopened.')}>Reopen for review</button>
                : <p className="callout warn">This report is closed. Only an administrator can reopen it.</p>)}

              {msg && <p className="ok-text" role="status" style={{ marginTop: 8 }}>{msg}</p>}

              <h4 style={{ marginTop: 20 }}>History</h4>
              <ol className="timeline">
                {s.history.map((h, i) => (
                  <li key={i} className="tl-item">
                    <StatusBadge status={h.status} />{h.internal && <span className="badge badge-sample">Staff only</span>}
                    <p className="tl-note">{h.note}</p><span className="muted small">{fmtDate(h.created_at)}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </aside>
      </div>
    </>
  )
}
