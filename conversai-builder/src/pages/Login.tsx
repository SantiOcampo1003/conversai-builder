import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Bot } from 'lucide-react'

export default function Login() {
  const { user, signInWithEmail, signInWithGoogle, signUpWithEmail } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState<string | null>(null)
  const [isSignup, setIsSignup] = useState(false)

  // Decodificar parámetros de invitación desde base64
  useEffect(() => {
    const stateParam = searchParams.get('state')
    if (stateParam) {
      try {
        const decoded = JSON.parse(atob(stateParam))
        if (decoded.email) {
          setEmail(decoded.email)
          setInviteEmail(decoded.email)
          setIsSignup(true) // Si viene de invitación, mostrar registro por defecto
        }
      } catch (err) {
        console.error('Error decoding state param:', err)
      }
    }
  }, [searchParams])

  // Si ya está autenticado, redirigir
  useEffect(() => {
    if (user) {
      const pendingToken = localStorage.getItem('pendingInviteToken')

      if (pendingToken) {
        // Si hay token de invitación pendiente, siempre ir ahí primero
        navigate(`/accept-invite?token=${pendingToken}`, { replace: true })
      } else {
        const stateParam = searchParams.get('state')
        let redirect = null

        if (stateParam) {
          try {
            const decoded = JSON.parse(atob(stateParam))
            redirect = decoded.redirect
          } catch (err) {
            console.error('Error decoding redirect:', err)
          }
        }

        if (redirect) {
          navigate(redirect, { replace: true })
        } else {
          navigate('/dashboard', { replace: true })
        }
      }
    }
  }, [user, navigate, searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = isSignup
      ? await signUpWithEmail(email, password)
      : await signInWithEmail(email, password)

    if (error) {
      if (isSignup) {
        setError('Error al crear la cuenta. Verifica que el email sea válido y la contraseña tenga al menos 6 caracteres.')
      } else {
        setError('Email o contraseña incorrectos')
      }
      setLoading(false)
    }
    // Si no hay error, el useEffect de arriba detecta el user y redirige
  }

  const handleGoogle = async () => {
    setError(null)
    await signInWithGoogle()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10 -z-10" />
      <div className="absolute top-20 right-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-20 left-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl -z-10" />

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg shadow-primary/40">
              <span className="text-3xl font-black text-white">e</span>
            </div>
            <div className="absolute inset-0 bg-primary/20 rounded-xl blur-md animate-pulse" />
          </div>
          <span className="text-3xl font-black gradient-text tracking-tight">easy</span>
          <span className="text-xs text-primary/70 tracking-wider">AI AGENTS</span>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-foreground">
              {inviteEmail
                ? 'Únete al equipo'
                : isSignup
                  ? 'Crea tu cuenta'
                  : 'Bienvenido de vuelta'}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {inviteEmail
                ? 'Crea una cuenta para aceptar la invitación'
                : isSignup
                  ? 'Crea tu cuenta para empezar a usar easy AI Agents'
                  : 'Inicia sesión para acceder a tu dashboard'}
            </p>
          </div>

          {/* Tabs Login/Signup - Solo si NO viene de invitación */}
          {!inviteEmail && (
            <div className="flex gap-2 mb-6 p-1 bg-secondary rounded-lg">
              <button
                type="button"
                onClick={() => setIsSignup(false)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  !isSignup
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => setIsSignup(true)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  isSignup
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Registrarse
              </button>
            </div>
          )}

          {/* Google */}
          <Button
            type="button"
            onClick={handleGoogle}
            variant="outline"
            className="w-full gap-2 border-2 mb-4 h-11"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continuar con Google
          </Button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">o con email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {inviteEmail && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4">
                <p className="text-xs text-primary font-medium">
                  📧 Invitación de equipo
                </p>
                <p className="text-xs text-primary/80 mt-1">
                  Crea tu cuenta con el email <span className="font-semibold">{inviteEmail}</span> para aceptar la invitación.
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="mt-1.5 h-11 border-2 bg-secondary/50"
                required
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-sm font-medium">
                Contraseña {isSignup && <span className="text-xs text-muted-foreground font-normal">(mínimo 6 caracteres)</span>}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 h-11 border-2 bg-secondary/50"
                required
                minLength={isSignup ? 6 : undefined}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/30"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isSignup ? 'Creando cuenta...' : 'Iniciando sesión...'}
                </>
              ) : (
                isSignup ? 'Crear cuenta' : 'Iniciar sesión'
              )}
            </Button>
          </form>
        </div>

        {!inviteEmail && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            {isSignup ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
            <button
              type="button"
              onClick={() => setIsSignup(!isSignup)}
              className="text-primary hover:underline font-medium"
            >
              {isSignup ? 'Inicia sesión' : 'Regístrate'}
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
