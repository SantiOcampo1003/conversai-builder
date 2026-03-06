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
        // Email de verificación (no bloqueante)
        emailRedirectTo: `${window.location.origin}/dashboard`,
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

    // Si el usuario se creó pero no está autenticado automáticamente
    // (puede pasar con enable_confirmations = false en algunas configuraciones)
    if (data.user && !data.session) {
      console.log('⚠️  No hay sesión, intentando auto-login...')

      // Pequeña espera para asegurar que el usuario está completamente creado
      await new Promise(resolve => setTimeout(resolve, 500))

      const { data: loginData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) {
        console.error('❌ Error en auto-login:', signInError)
        return { error: signInError }
      }

      console.log('✅ Auto-login exitoso, sesión creada:', loginData.session?.user.id)

      // Enviar email de verificación manualmente (ya que enable_confirmations está OFF)
      try {
        console.log('📧 Enviando email de verificación...')
        await supabase.auth.resend({
          type: 'signup',
          email: email,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`
          }
        })
        console.log('✅ Email de verificación enviado')
      } catch (emailError) {
        console.warn('⚠️  Error enviando email de verificación (no crítico):', emailError)
      }

      return { error: null }
    }

    // Si hay sesión automática, también enviar email de verificación
    if (data.session && data.user && !data.user.email_confirmed_at) {
      try {
        console.log('📧 Enviando email de verificación...')
        await supabase.auth.resend({
          type: 'signup',
          email: email,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`
          }
        })
        console.log('✅ Email de verificación enviado')
      } catch (emailError) {
        console.warn('⚠️  Error enviando email de verificación (no crítico):', emailError)
      }
    }

    console.log('✅ Sesión creada automáticamente')
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
