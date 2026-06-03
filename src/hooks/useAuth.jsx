import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = cargando
  const [usuario, setUsuario] = useState(null)
  const [usuarioError, setUsuarioError] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchUsuario(session.user.id)
      else setSession(null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        setUsuarioError(false)
        fetchUsuario(session.user.id)
      } else {
        setUsuario(null)
        setUsuarioError(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchUsuario(uid) {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', uid)
      .single()

    if (data) {
      setUsuario(data)
    } else {
      // Auth OK pero no hay perfil en tabla usuarios (setup incompleto)
      setUsuario(null)
      setUsuarioError(true)
      console.warn('Sin perfil en tabla usuarios:', uid, error?.message)
    }
  }

  async function signIn(email, password) {
    setUsuarioError(false)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUsuario(null)
    setUsuarioError(false)
  }

  return (
    <AuthContext.Provider value={{ session, usuario, usuarioError, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
