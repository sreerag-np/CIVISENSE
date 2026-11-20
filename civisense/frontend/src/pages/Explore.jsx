import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapContainer, CircleMarker, Popup } from 'react-leaflet'
import { MapPin, ThumbsUp } from 'lucide-react'
import { api, STATUS_COLOR } from '../api.js'
import { useAuth } from '../auth.jsx'
import { CategoryIcon, DEFAULT_CENTER, Empty, FlyTo, PageHead, SampleTag, Skeleton, StatusBadge, TierBadge, Tiles } from '../components.jsx'

export default function Explore() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [cats, setCats] = useState([])
  const [statuses, setStatuses] = useState([])
  const [filters, setFilters] = useState({ status: '', category: '' })
  const [reports, setReports] = useState(null)
  const [selected, setSelected] = useState(null)
  const [notice, setNotice] = useState('')

  useEffect(() => { api.meta().then((m) => { setCats(m.categories); setStatuses(m.statuses) }).catch(() => {}) }, [])
  useEffect(() => {
    setReports(null); setNotice('')
    api.reports(filters).then(setReports).catch((e) => { setNotice(e.message); setReports([]) })
  }, [filters])

  const focus = useMemo(() => {
    const r = reports?.find((x) => x.ref === selected)
    return r ? [r.lat, r.lng] : null
  }, [reports, selected])

  const support = async (ref) => {
    if (!user) { nav('/login'); return }
    setNotice('')
    try {
      const { supports } = await api.support(ref)
      setReports((rs) => rs.map((r) => (r.ref === ref ? { ...r, supports } : r)))
    } catch (e) { setNotice(e.message) }
  }

  return (
    <>
      <PageHead title="Reports on the map">
        Every report filed so far. Select one to see it on the map, and support the ones that affect you too.
      </PageHead>

      <div className="row" style={{ marginBottom: 14 }}>
        <div className="chips" role="radiogroup" aria-label="Filter by category">
          <button className="chip" role="radio" aria-checked={filters.category === ''} onClick={() => setFilters({ ...filters, category: '' })}>All</button>
          {cats.map((c) => (
            <button key={c.id} className="chip" role="radio" aria-checked={filters.category === c.id}
                    onClick={() => setFilters({ ...filters, category: filters.category === c.id ? '' : c.id })}>
              <CategoryIcon category={c.id} size={15} /> {c.label}
            </button>
          ))}
        </div>
        <select className="input" style={{ width: 'auto' }} aria-label="Filter by status" value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Any status</option>
          {statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>
      {notice && <p className="callout error" role="alert">{notice}</p>}

      <div className="explore">
        <MapContainer center={DEFAULT_CENTER} zoom={11} className="map" style={{ height: 600 }}>
          <Tiles />
          <FlyTo position={focus} />
          {(reports || []).map((r) => (
            <CircleMarker key={r.ref} center={[r.lat, r.lng]} radius={r.ref === selected ? 13 : 9}
                          pathOptions={{ color: '#fff', weight: 2, fillColor: STATUS_COLOR[r.status], fillOpacity: 0.95 }}
                          eventHandlers={{ click: () => setSelected(r.ref) }}>
              <Popup>
                <strong>{r.category_label}</strong><br />{r.description.slice(0, 100)}<br />
                <Link to={`/track/${r.ref}`}>{r.ref}</Link>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        <div className="explore-list" aria-live="polite">
          {reports === null ? <div style={{ padding: 14 }}><Skeleton rows={4} /></div> : reports.length === 0 ? (
            <Empty icon={MapPin} title="No reports match">Clear a filter, or file a report if you spot a problem.</Empty>
          ) : reports.map((r) => (
            <article key={r.ref} className={r.ref === selected ? 'rep sel' : 'rep'}>
              <button className="rep-main" onClick={() => setSelected(r.ref)} aria-label={`Show ${r.category_label} ${r.ref} on the map`}>
                <span className="rep-meta">
                  <strong>{r.category_label}</strong><StatusBadge status={r.status} />
                  <SampleTag show={r.is_sample} />
                </span>
                <span className="muted small">{r.description.slice(0, 110)}{r.description.length > 110 ? '…' : ''}</span>
                <span className="rep-meta"><TierBadge tier={r.tier} chi={r.chi} /></span>
                {r.image_url && <img className="rep-img" src={r.image_url} alt="" loading="lazy" />}
              </button>
              <div className="rep-actions">
                <button className="btn sm" onClick={() => support(r.ref)} aria-label={`Support this report. ${r.supports} supporters`}>
                  <ThumbsUp size={14} /> {r.supports}
                </button>
                <Link className="small" to={`/track/${r.ref}`}>Details</Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  )
}
