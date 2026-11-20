import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, LocateFixed, Sparkles, Trash2 } from 'lucide-react'
import { api } from '../api.js'
import { CategoryIcon, CopyButton, LocationPicker, PageHead, RoadProgress, useGeolocate } from '../components.jsx'

const TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

export default function Report() {
  const [cats, setCats] = useState([])
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [address, setAddress] = useState('')
  const [position, setPosition] = useState(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [drag, setDrag] = useState(false)
  const [suggestion, setSuggestion] = useState(null)
  const [suggesting, setSuggesting] = useState(false)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const geo = useGeolocate((p) => { setPosition(p); setErrors((e) => ({ ...e, position: undefined })) })

  useEffect(() => { api.meta().then((m) => setCats(m.categories)).catch(() => {}) }, [])

  useEffect(() => {
    if (!file) { setPreview(null); return undefined }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const takeFile = (f) => {
    if (!f) return
    if (!TYPES.includes(f.type)) { setErrors((e) => ({ ...e, file: 'Use a JPEG, PNG or WebP photo.' })); return }
    if (f.size > MAX_BYTES) { setErrors((e) => ({ ...e, file: 'That photo is over 5 MB. Choose a smaller one.' })); return }
    setErrors((e) => ({ ...e, file: undefined })); setFile(f)
  }

  const suggest = async () => {
    if (description.trim().length < 10) { setErrors((e) => ({ ...e, description: 'Write at least 10 characters first.' })); return }
    setSuggesting(true)
    try { setSuggestion(await api.classify(description, file?.name || '')) }
    catch (err) { setErrors((e) => ({ ...e, form: err.message })) }
    finally { setSuggesting(false) }
  }

  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (description.trim().length < 10) next.description = 'Describe the problem in at least 10 characters.'
    if (!position) next.position = 'Set the location: use your location or click the map.'
    setErrors(next)
    if (Object.keys(next).length) return
    const fd = new FormData()
    fd.append('description', description.trim())
    fd.append('lat', position[0]); fd.append('lng', position[1])
    if (category) fd.append('category', category)
    if (address.trim()) fd.append('address', address.trim())
    if (file) fd.append('image', file)
    setBusy(true)
    try { setResult(await api.createReport(fd)) }
    catch (err) { setErrors({ form: err.message }) }
    finally { setBusy(false) }
  }

  const reset = () => {
    setResult(null); setDescription(''); setFile(null); setSuggestion(null); setCategory(''); setAddress(''); setErrors({})
  }

  if (result) {
    return (
      <div className="success">
        <PageHead title="Report filed">Keep your reference number. It is the only way to look this report up later.</PageHead>
        <div className="ticket" style={{ cursor: 'default' }}>
          <p className="ticket-label">Reference</p>
          <p className="ticket-title ref" style={{ fontSize: '2rem' }}>{result.ref}</p>
          <div className="row" style={{ marginBottom: 16 }}><CopyButton text={result.ref} /></div>
          <RoadProgress status={result.status} />
        </div>
        <div className="panel" style={{ marginTop: 16 }}>
          <p><strong>{result.category_label}</strong> <span className="muted small">(suggested by {result.ai_method || 'n/a'}, confirmed by you if you picked one)</span></p>
          <p className="muted">
            {result.authority ? `Sent to ${result.authority}. ` : 'It needs to be routed by staff. '}{result.routing_note}
          </p>
          {result.possible_duplicate && (
            <p className="callout warn">A similar open report is already nearby ({result.duplicate_of_ref}). Staff will review and link them.</p>
          )}
          <div className="row">
            <Link className="btn primary" to={`/track/${result.ref}`}>Track this report</Link>
            <button className="btn" onClick={reset}>File another report</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHead title="Report an issue">A photo, a short description and a spot on the map are enough.</PageHead>
      <form className="report-grid" onSubmit={submit} noValidate>
        <div className="stack">
          {errors.form && <p className="callout error" role="alert">{errors.form}</p>}

          <section className="form-section">
            <h3>Photo</h3>
            <label className={drag ? 'drop drag' : 'drop'}
                   onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
                   onDrop={(e) => { e.preventDefault(); setDrag(false); takeFile(e.dataTransfer.files[0]) }}>
              <input type="file" className="sr-only" accept={TYPES.join(',')} onChange={(e) => takeFile(e.target.files[0])} />
              {preview ? <img className="drop-preview" src={preview} alt="Your photo of the problem" /> : (
                <>
                  <Camera size={30} />
                  <strong>Add a photo</strong>
                  <span>Drag one here, or tap to take or choose one. JPEG, PNG or WebP, up to 5 MB.</span>
                </>
              )}
            </label>
            {file && <div className="row" style={{ marginTop: 8 }}><button type="button" className="btn sm" onClick={() => setFile(null)}><Trash2 size={14} /> Remove photo</button></div>}
            {errors.file && <p className="field-error" role="alert">{errors.file}</p>}
          </section>

          <section className="form-section">
            <h3>What&rsquo;s wrong</h3>
            <div className="field">
              <label className="field-label" htmlFor="desc">Description</label>
              <textarea id="desc" className="input" value={description} maxLength={1000}
                        aria-invalid={!!errors.description} aria-describedby="desc-help"
                        placeholder="What is the problem, and where exactly? For example: deep pothole in front of the bus stand."
                        onChange={(e) => { setDescription(e.target.value); setErrors((x) => ({ ...x, description: undefined })) }} />
              <div className="row between">
                <span id="desc-help" className="hint">{errors.description ? <span className="field-error">{errors.description}</span> : 'Mention danger to people if there is any.'}</span>
                <span className="hint counter">{description.length}/1000</span>
              </div>
            </div>

            <div className="field">
              <span className="field-label" id="cat-label">Category</span>
              <div className="chips" role="radiogroup" aria-labelledby="cat-label">
                <button type="button" role="radio" aria-checked={category === ''} className="chip" onClick={() => setCategory('')}>Choose for me</button>
                {cats.map((c) => (
                  <button key={c.id} type="button" role="radio" aria-checked={category === c.id} className="chip" onClick={() => setCategory(c.id)}>
                    <CategoryIcon category={c.id} size={15} /> {c.label}
                  </button>
                ))}
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <button type="button" className="btn sm" onClick={suggest} disabled={suggesting}>
                  <Sparkles size={14} /> {suggesting ? 'Checking…' : 'Suggest a category'}
                </button>
              </div>
              {suggestion && (
                <div className="callout" role="status">
                  Looks like <strong>{suggestion.label}</strong> ({Math.round(suggestion.confidence * 100)}% confidence, {suggestion.method}).{' '}
                  <button type="button" className="btn sm" onClick={() => setCategory(suggestion.category)}>Use {suggestion.label}</button>
                  <p className="hint" style={{ marginTop: 6 }}>{suggestion.note}</p>
                </div>
              )}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="addr">Landmark or address (optional)</label>
              <input id="addr" className="input" value={address} maxLength={200} placeholder="Near the bus stand, ward 12"
                     onChange={(e) => setAddress(e.target.value)} />
            </div>
          </section>

          <button className="btn primary lg" disabled={busy}>{busy ? 'Filing…' : 'File report'}</button>
        </div>

        <section className="form-section map-sticky">
          <h3>Where it is</h3>
          <div className="row" style={{ marginBottom: 10 }}>
            <button type="button" className="btn" onClick={geo.locate} disabled={geo.busy}>
              <LocateFixed size={16} /> {geo.busy ? 'Locating…' : 'Use my location'}
            </button>
            <span className="hint">or click the map to place the pin</span>
          </div>
          {geo.error && <p className="callout warn">{geo.error}</p>}
          <LocationPicker position={position} onChange={(p) => { setPosition(p); setErrors((x) => ({ ...x, position: undefined })) }} />
          <p className="hint" style={{ marginTop: 8 }}>
            {position ? `Pin set at ${position[0].toFixed(5)}, ${position[1].toFixed(5)}. Click the map to move it.` : 'No pin yet.'}
          </p>
          {errors.position && <p className="field-error" role="alert">{errors.position}</p>}
        </section>
      </form>
    </>
  )
}
