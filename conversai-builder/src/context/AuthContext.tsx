import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUpWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signInWithGoogle: () => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      // Al volver a la pestaña Supabase refresca el token y entrega un objeto `user` nuevo aunque
      // sea la misma persona. Conservar el anterior evita que todas las vistas recarguen con skeleton.
      const next = session?.user ?? null
      setUser(prev => (prev?.id === next?.id && event !== 'USER_UPDATED' ? prev : next))
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Redirigir al home para que continúe creando su agente
        emailRedirectTo: `${window.location.origin}/`,
      }
    })

    if (error) {
      console.error('Error en signup:', error)
      return { error }
    }

    // Con enable_confirmations = false:
    // - signUp crea una sesión automáticamente
    // - No se envían emails de confirmación
    // - El usuario puede usar la app de inmediato

    return { error: null }
  }

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    })
    return { error }
  }

  const signOut = async () => {
    // Limpiar sessionStorage antes de cerrar sesión
    sessionStorage.removeItem('super_admin_impersonating')

    // Cerrar sesión en Supabase
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
