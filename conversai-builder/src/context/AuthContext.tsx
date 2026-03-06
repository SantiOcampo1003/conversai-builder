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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUpWithEmail = async (email: string, password: string) => {
    console.log('🔐 Iniciando registro de usuario...')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Redirigir al home para que continúe creando su agente
        emailRedirectTo: `${window.location.origin}/`,
        // Datos adicionales del usuario
        data: {
          email_verified: false,
        }
      }
    })

    if (error) {
      console.error('❌ Error en signup:', error)
      return { error }
    }

    console.log('✅ Usuario creado:', data.user?.id)
    console.log('📝 Sesión después del signup:', data.session ? 'SÍ' : 'NO')
    console.log('📧 Email confirmed at:', data.user?.email_confirmed_at)

    // Con enable_confirmations = true:
    // - signUp SIEMPRE crea una sesión temporal (no bloqueante)
    // - El email se envía automáticamente
    // - El usuario puede usar la app mientras no confirme

    // Si hay sesión (sea confirmada o no), el usuario puede acceder
    if (data.session) {
      console.log('✅ Sesión creada - Usuario puede acceder a la app')
      return { error: null }
    }

    // Si NO hay sesión (caso raro), es un error
    console.error('❌ No se creó sesión después del signup')
    return { error: new Error('No se pudo crear la sesión') as any }
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
