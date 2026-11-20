import { useEffect, useRef, useState } from 'react'
import { Check, Monitor, Moon, Palette, Sun } from 'lucide-react'
import { ACCENTS, useTheme } from './theme.jsx'

const MODE_OPTIONS = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'system', label: 'System', Icon: Monitor },
]

export default function ThemeMenu() {
  const { mode, accent, resolved, setMode, setAccent } = useTheme()
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const button = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus() } }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="theme-menu" ref={root}>
      <button ref={button} type="button" className="icon-btn" aria-haspopup="dialog" aria-expanded={open}
              aria-label="Choose theme" title="Theme" onClick={() => setOpen((o) => !o)}>
        <Palette size={18} />
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Theme settings">
          <p className="popover-title">Appearance</p>
          <div className="segmented" role="radiogroup" aria-label="Appearance">
            {MODE_OPTIONS.map(({ id, label, Icon }) => (
              <button key={id} type="button" role="radio" aria-checked={mode === id}
                      className={mode === id ? 'seg on' : 'seg'} onClick={() => setMode(id)}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
          {mode === 'system' && <p className="hint">Following your device: currently {resolved}.</p>}
          <p className="popover-title">Accent colour</p>
          <div className="swatches" role="radiogroup" aria-label="Accent colour">
            {ACCENTS.map((a) => (
              <button key={a.id} type="button" role="radio" aria-checked={accent === a.id} aria-label={a.label}
                      title={a.label} className={accent === a.id ? 'swatch on' : 'swatch'}
                      style={{ background: a.swatch }} onClick={() => setAccent(a.id)}>
                {accent === a.id && <Check size={16} color={a.id === 'road' ? '#17201D' : '#fff'} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
