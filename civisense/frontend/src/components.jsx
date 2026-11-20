import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, useMapEvents, useMap } from 'react-leaflet'
import { Check, Construction, Copy, Droplets, Info, Inbox, Lightbulb, Trash2, TreePine, Waves } from 'lucide-react'
import { RISK_COLOR, RISK_LABEL, STATUS_COLOR, STATUS_LABEL, TIER_COLOR, publicStatus } from './api.js'

export const DEFAULT_CENTER = [12.0373, 75.3589] // Taliparamba / north Kannur
export const FLOW = ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved']

const CATEGORY_ICON = {
  road_damage: Construction, garbage: Trash2, street_light: Lightbulb,
  water_supply: Droplets, drainage: Waves, fallen_tree: TreePine, other: Info,
}

export function CategoryIcon({ category, size = 20 }) {
  const Icon = CATEGORY_ICON[category] || Info
  return <Icon size={size} aria-hidden="true" />
}

export function StatusBadge({ status }) {
  return <span className="badge" style={{ background: STATUS_COLOR[status] }}>{STATUS_LABEL[status] || status}</span>
}

export function RiskBadge({ risk }) {
  return <span className="badge" style={{ background: RISK_COLOR[risk] }}>{RISK_LABEL[risk] || risk}</span>
}

export function TierBadge({ tier, chi }) {
  return (
    <span className="badge" style={{ background: TIER_COLOR[tier] }}
          title="Civic Hazard Index: a prototype 1-100 priority estimate from category, severity, supporters and age">
      CHI {chi} &middot; {tier}
    </span>
  )
}

export function SlaTag({ report }) {
  if (['resolved', 'rejected'].includes(report.status)) return null
  return report.overdue
    ? <span className="badge" style={{ background: 'var(--danger)' }}>Overdue</span>
    : <span className="muted small">Target {report.sla_hours}h</span>
}

export function SampleTag({ show }) {
  return show ? <span className="badge badge-sample">Sample data</span> : null
}

/** Progress drawn as a road line: dashed where work is still ahead, solid where it is done. */
export function RoadProgress({ status: raw }) {
  const status = publicStatus(raw)
  if (status === 'rejected') {
    return <p className="callout error" role="status">This report was closed without action. The history below says why.</p>
  }
  const idx = Math.max(0, FLOW.indexOf(status))
  return (
    <ol className="road" aria-label={`Progress: ${STATUS_LABEL[status] || status}`}>
      {FLOW.map((s, i) => {
        const done = i < idx || (status === 'resolved' && i === idx)
        const state = done ? 'done' : i === idx ? 'now' : 'todo'
        return (
          <li key={s} className={`road-step ${state}`} aria-current={i === idx ? 'step' : undefined}>
            <span className="road-node">{done ? <Check size={13} strokeWidth={3} /> : null}</span>
            <span className="road-label">{STATUS_LABEL[s]}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function PageHead({ title, children, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {children && <p className="page-sub">{children}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  )
}

export function Empty({ icon: Icon = Inbox, title, children }) {
  return (
    <div className="empty">
      <Icon size={28} aria-hidden="true" />
      <p className="empty-title">{title}</p>
      {children && <p className="muted">{children}</p>}
    </div>
  )
}

export function Skeleton({ rows = 3 }) {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton-row" />)}
    </div>
  )
}

export function CopyButton({ text, label = 'Copy reference' }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800) }
    catch { /* clipboard blocked: the reference is still visible to select */ }
  }
  return (
    <button type="button" className="btn sm" onClick={copy}>
      {done ? <Check size={14} /> : <Copy size={14} />} {done ? 'Copied' : label}
    </button>
  )
}

/** One report as a row: used on the home page. */
export function ReportRow({ r }) {
  return (
    <Link to={`/track/${r.ref}`} className="report-row">
      <span className="report-thumb">
        {r.image_url ? <img src={r.image_url} alt="" loading="lazy" /> : <CategoryIcon category={r.category} />}
      </span>
      <span className="report-main">
        <span className="report-title">{r.category_label} <SampleTag show={r.is_sample} /></span>
        <span className="muted report-desc">{r.description}</span>
      </span>
      <span className="report-side"><StatusBadge status={r.status} /></span>
    </Link>
  )
}

export function Tiles() {
  return <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
}

function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) })
  return null
}

function Recenter({ position }) {
  const map = useMap()
  useEffect(() => { if (position) map.setView(position, Math.max(map.getZoom(), 16)) }, [position]) // eslint-disable-line
  return null
}

export function FlyTo({ position }) {
  const map = useMap()
  useEffect(() => { if (position) map.flyTo(position, Math.max(map.getZoom(), 15), { duration: 0.6 }) }, [position]) // eslint-disable-line
  return null
}

export function LocationPicker({ position, onChange, height = 320 }) {
  return (
    <MapContainer center={position || DEFAULT_CENTER} zoom={position ? 16 : 12} className="map" style={{ height }}>
      <Tiles />
      <ClickHandler onPick={onChange} />
      <Recenter position={position} />
      {position && <CircleMarker center={position} radius={11} pathOptions={{ color: '#B3362B', weight: 3, fillColor: '#F2B705', fillOpacity: 0.9 }} />}
    </MapContainer>
  )
}

export function useGeolocate(onFound) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const locate = () => {
    if (!navigator.geolocation) { setError('This browser cannot share your location. Click the map to place the pin.'); return }
    setBusy(true); setError('')
    navigator.geolocation.getCurrentPosition(
      (p) => { onFound([p.coords.latitude, p.coords.longitude]); setBusy(false) },
      () => { setError('Could not get your location. Click the map to place the pin instead.'); setBusy(false) },
      { enableHighAccuracy: true, timeout: 10000 })
  }
  return { locate, busy, error }
}
