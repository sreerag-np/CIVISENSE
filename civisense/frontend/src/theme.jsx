import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export const ACCENTS = [
  { id: 'road', label: 'Road yellow', swatch: '#F2B705' },
  { id: 'monsoon', label: 'Monsoon green', swatch: '#1F7A5C' },
  { id: 'coast', label: 'Coast blue', swatch: '#1D64B8' },
  { id: 'laterite', label: 'Laterite red', swatch: '#B8472A' },
]
export const MODES = ['light', 'dark', 'system']
const KEY = 'cs_theme'
const DEFAULTS = { mode: 'system', accent: 'road' }
const darkQuery = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null)

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    if (raw === 'light' || raw === 'dark') return { ...DEFAULTS, mode: raw } // older versions stored a plain string
    const v = JSON.parse(raw)
    return {
      mode: MODES.includes(v.mode) ? v.mode : DEFAULTS.mode,
      accent: ACCENTS.some((a) => a.id === v.accent) ? v.accent : DEFAULTS.accent,
    }
  } catch { return DEFAULTS }
}

const Ctx = createContext(null)
export const useTheme = () => useContext(Ctx)

export function ThemeProvider({ children }) {
  const [prefs, setPrefs] = useState(read)
  const [systemDark, setSystemDark] = useState(() => !!darkQuery()?.matches)

  useEffect(() => {
    const mq = darkQuery()
    if (!mq) return undefined
    const on = (e) => setSystemDark(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const resolved = prefs.mode === 'system' ? (systemDark ? 'dark' : 'light') : prefs.mode

  useEffect(() => {
    const r = document.documentElement
    r.setAttribute('data-theme', resolved)
    r.setAttribute('data-accent', prefs.accent)
  }, [resolved, prefs.accent])

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)) } catch { /* storage may be blocked */ }
  }, [prefs])

  const setMode = useCallback((mode) => setPrefs((p) => ({ ...p, mode })), [])
  const setAccent = useCallback((accent) => setPrefs((p) => ({ ...p, accent })), [])
  const value = useMemo(() => ({ ...prefs, resolved, setMode, setAccent }), [prefs, resolved, setMode, setAccent])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
