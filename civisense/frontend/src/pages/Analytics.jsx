import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { PageHead, Skeleton } from '../components.jsx'

function Bars({ data, title }) {
  const entries = Object.entries(data || {})
  const max = Math.max(1, ...entries.map(([, v]) => v))
  return (
    <div className="panel">
      <h3>{title}</h3>
      {entries.length === 0 && <p className="muted">Nothing to show yet.</p>}
      {entries.map(([k, v]) => (
        <div key={k} className="bar-row">
          <span className="bar-label">{k.replace('_', ' ')}</span>
          <div className="bar" role="img" aria-label={`${k.replace('_', ' ')}: ${v}`}><div style={{ width: `${(v / max) * 100}%` }} /></div>
          <span className="bar-num">{v}</span>
        </div>
      ))}
    </div>
  )
}

function Figure({ value, label, small }) {
  return (
    <div className="figure">
      <div className={small ? 'figure-value small-value' : 'figure-value'}>{value}</div>
      <div className="figure-label">{label}</div>
    </div>
  )
}

export default function Analytics() {
  const [a, setA] = useState(null)
  const [error, setError] = useState('')
  const [includeSample, setIncludeSample] = useState(true)

  useEffect(() => {
    setError('')
    api.analytics(includeSample).then(setA).catch((e) => setError(e.message))
  }, [includeSample])

  if (error) return <p className="callout error" role="alert">{error}</p>
  if (!a) return <Skeleton rows={3} />
  const hours = (v) => (v === null ? 'Not enough data' : `${v} h`)

  return (
    <>
      <PageHead title="Analytics"
                actions={<label className="check"><input type="checkbox" checked={includeSample} onChange={(e) => setIncludeSample(e.target.checked)} /> Include sample records</label>}>
        {a.basis}
        {a.include_sample && a.sample_records > 0 && ` ${a.sample_records} of ${a.total} records are sample data.`}
      </PageHead>

      <div className="figures">
        <Figure value={a.total} label="Reports filed" />
        <Figure value={a.open} label="Still open" />
        <Figure value={a.overdue} label="Past response target" />
        <Figure value={a.avg_open_chi ?? 'n/a'} label="Average hazard index of open reports" />
        <Figure small value={hours(a.avg_first_response_hours)} label="Average time to first response" />
        <Figure small value={hours(a.avg_resolution_hours)} label="Average time to resolve" />
        <Figure small value={a.resolved_within_sla_pct === null ? 'Not enough data' : `${a.resolved_within_sla_pct}%`} label="Resolved within target" />
      </div>

      <div className="bars-grid">
        <Bars title="By status" data={a.by_status} />
        <Bars title="By category" data={a.by_category} />
        <Bars title="Open reports by hazard tier" data={a.open_by_tier} />
        <Bars title="Open reports by local body" data={a.open_by_authority} />
      </div>
    </>
  )
}
