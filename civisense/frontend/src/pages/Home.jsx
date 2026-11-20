import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Search } from 'lucide-react'
import { api } from '../api.js'
import { Empty, ReportRow, RoadProgress, SampleTag, Skeleton, StatusBadge } from '../components.jsx'

export default function Home() {
  const [reports, setReports] = useState(null)
  const [stats, setStats] = useState(null)
  const [apiDown, setApiDown] = useState(false)

  useEffect(() => {
    api.reports({ limit: 6 }).then(setReports).catch(() => { setApiDown(true); setReports([]) })
    api.analytics(true).then(setStats).catch(() => {})
  }, [])

  const latest = reports?.[0]

  return (
    <>
      <section className="hero">
        <div>
          <h1>Fix what&rsquo;s broken on your street.</h1>
          <p className="lede">
            Report a pothole, a dead street light or a pile of garbage in under a minute. Your report goes to the
            local body, and you can follow it until it is fixed.
          </p>
          <div className="row">
            <Link className="btn primary lg" to="/report"><Camera size={20} /> Report an issue</Link>
            <Link className="btn lg" to="/track"><Search size={20} /> Track a report</Link>
          </div>
          {stats && stats.total > 0 && (
            <p className="muted hero-note">
              {stats.total} reports filed, {stats.resolved} resolved.
              {stats.sample_records > 0 && ` ${stats.sample_records} of them are sample data.`}
            </p>
          )}
          {apiDown && (
            <p className="callout warn hero-note">
              The website cannot reach the server. Start the backend with <code>uvicorn app.main:app --reload</code>.
            </p>
          )}
        </div>

        {latest ? (
          <Link to={`/track/${latest.ref}`} className="ticket" aria-label={`Latest report ${latest.ref}`}>
            <p className="ticket-label">Latest report <SampleTag show={latest.is_sample} /></p>
            <p className="ticket-title">{latest.category_label}</p>
            <p className="ticket-desc">{latest.description}</p>
            <RoadProgress status={latest.status} />
            <div className="row between" style={{ marginTop: 8 }}>
              <span className="ref">{latest.ref}</span><StatusBadge status={latest.status} />
            </div>
          </Link>
        ) : (
          <div className="ticket">
            <p className="ticket-label">Latest report</p>
            <p className="ticket-title">Nothing reported yet</p>
            <p className="ticket-desc">The first report you file will show up here, with its progress.</p>
            <RoadProgress status="submitted" />
          </div>
        )}
      </section>

      <div className="section-title"><h2>How a report moves</h2></div>
      <div className="panel">
        <RoadProgress status="in_progress" />
        <p className="muted" style={{ margin: '12px 0 0', maxWidth: '70ch' }}>
          You file the report. Staff review it, assign a team, and the work starts. Every change is saved with a time and
          a note, so you can always see what happened and who did it.
        </p>
      </div>

      <div className="section-title">
        <h2>Recent reports</h2>
        <Link to="/explore">See all on the map</Link>
      </div>
      {reports === null ? <Skeleton rows={3} /> : reports.length === 0 ? (
        <div className="panel"><Empty title="No reports yet">Be the first: file a report and it will appear here.</Empty></div>
      ) : (
        <div className="report-list">{reports.map((r) => <ReportRow key={r.ref} r={r} />)}</div>
      )}
    </>
  )
}
