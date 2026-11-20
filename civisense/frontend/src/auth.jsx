import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api.js'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!getToken()) { setReady(true); return }
    api.me().then(setUser).catch(() => setToken(null)).finally(() => setReady(true))
  }, [])

  useEffect(() => {
    const onExpired = () => setUser(null)
    window.addEventListener('cs-auth-expired', onExpired)
    return () => window.removeEventListener('cs-auth-expired', onExpired)
  }, [])

  const login = async (email, password) => {
    const r = await api.login(email, password)
    setToken(r.token); setUser(r.user); return r.user
  }
  const register = async (name, email, password) => {
    const r = await api.register(name, email, password)
    setToken(r.token); setUser(r.user); return r.user
  }
  const logout = () => { setToken(null); setUser(null) }

  return <Ctx.Provider value={{ user, ready, login, register, logout }}>{children}</Ctx.Provider>
}
