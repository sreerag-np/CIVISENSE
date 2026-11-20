import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { api, fmtDate } from '../api.js'
import { CopyButton, PageHead, RoadProgress, SampleTag, Skeleton, SlaTag, StatusBadge, TierBadge } from '../components.jsx'

export default function Track() {
  const { ref: paramRef } = useParams()
  const nav = useNavigate()
  const [input, setInput] = useState(paramRef || '')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setReport(null); setError('')
    if (!paramRef) return
    setInput(paramRef); setLoading(true)
    api.report(paramRef).then(setReport).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [paramRef])

  const search = (e) => { e.preventDefault(); if (input.trim()) nav(`/track/${input.trim().toUpperCase()}`) }

  return (
    <div style={{ maxWidth: 820 }}>
      <PageHead title="Track a report">Enter the reference you got when you filed it. It looks like CS-20261118-AB12C.</PageHead>
      <form className="search-bar" onSubmit={search} role="search">
        <input className="input" aria-label="Report reference" value={input} onChange={(e) => setInput(e.target.value)} placeholder="CS-20261118-AB12C" autoComplete="off" />
        <button className="btn primary"><Search size={16} /> Find report</button>
      </form>

      {loading && <Skeleton rows={3} />}
      {error && <p className="callout error" role="alert">{error === 'Report not found.' ? 'No report has that reference. Check it for typos and try again.' : error}</p>}

      {report && (
        <div className="panel">
          <div className="row between">
            <div>
              <h2 style={{ marginBottom: 2 }}>{report.category_label} <SampleTag show={report.is_sample} /></h2>
              <span className="ref">{report.ref}</span>
            </div>
            <CopyButton text={report.ref} />
          </div>

          <RoadProgress status={report.status} />

          <p style={{ marginTop: 12 }}>{report.description}</p>
          {report.image_url && <img src={report.image_url} alt="Photo attached to the report" style={{ borderRadius: 8, maxHeight: 320 }} />}

          <dl className="facts">
            <div className="fact"><dt>Status</dt><dd><StatusBadge status={report.status} /></dd></div>
            <div className="fact"><dt>Local body</dt><dd>{report.authority || 'Waiting to be routed'}</dd></div>
            <div className="fact"><dt>Department</dt><dd>{report.department || 'Not set'}</dd></div>
            <div className="fact"><dt>Assigned to</dt><dd>{report.assigned_to || 'Nobody yet'}</dd></div>
            {report.workers != null && <div className="fact"><dt>Workers assigned</dt><dd>{report.workers}</dd></div>}
            <div className="fact"><dt>Priority</dt><dd><TierBadge tier={report.tier} chi={report.chi} /></dd></div>
            <div className="fact"><dt>Response target</dt><dd>{['resolved', 'rejected'].includes(report.status) ? 'Closed' : <SlaTag report={report} />}</dd></div>
          </dl>
          {report.duplicate_of_ref && <p className="callout warn">This looks like a duplicate of {report.duplicate_of_ref}. Staff will link them.</p>}
          <p className="hint">{report.routing_note} Category suggested by {report.ai_method || 'n/a'}. Priority is a prototype estimate.</p>

          <h3 style={{ marginTop: 22 }}>History</h3>
          <ol className="timeline">
            {report.history.map((h, i) => (
              <li key={i} className="tl-item">
                <StatusBadge status={h.status} />
                <p className="tl-note">{h.note}</p>
                <span className="muted small">{fmtDate(h.created_at)} &middot; {h.actor_role}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
