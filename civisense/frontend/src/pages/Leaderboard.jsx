import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { api } from '../api.js'
import { Empty, PageHead, Skeleton } from '../components.jsx'

export default function Leaderboard() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { api.leaderboard().then(setRows).catch((e) => setError(e.message)) }, [])

  return (
    <div style={{ maxWidth: 760 }}>
      <PageHead title="Civic leaderboard">
        Points: 10 for each report, 25 when it is resolved, 2 for each support from another citizen. Sample data,
        rejected reports and duplicates earn nothing. Only a first name and last initial are shown.
      </PageHead>
      {error && <p className="callout error" role="alert">{error}</p>}
      {!rows && !error && <Skeleton rows={4} />}
      {rows && (rows.length === 0 ? (
        <div className="panel">
          <Empty icon={Trophy} title="Nobody is ranked yet">Log in and file a report to be the first on the board.</Empty>
          <div className="row" style={{ justifyContent: 'center' }}><Link className="btn primary" to="/report">Report an issue</Link></div>
        </div>
      ) : (
        <div className="report-list">
          {rows.map((r) => (
            <div key={r.rank} className={r.rank <= 3 ? 'lb-row top' : 'lb-row'}>
              <span className="lb-rank">{r.rank}</span>
              <div>
                <div className="lb-name">{r.name}</div>
                <div className="muted small">{r.reports} reports &middot; {r.resolved} resolved &middot; {r.supports} supports</div>
              </div>
              <span className="lb-karma" aria-label={`${r.karma} points`}>{r.karma}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
