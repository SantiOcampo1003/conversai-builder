import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Loader2, Mail, Lock, User, AlertCircle } from 'lucide-react'

interface AuthModalProps {
  open: boolean
  onSuccess: () => void
}

type AuthMode = 'login' | 'signup'

export function AuthModal({ open, onSuccess }: AuthModalProps) {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth()

  const [mode, setMode] = useState<AuthMode>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const clearState = () => {
    setError(null)
    setSuccessMessage(null)
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearState()

    if (!email || !password) {
      setError('Completa todos los campos')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await signUpWithEmail(email, password)
        if (error) {
          if (error.message.includes('already registered') || error.message.includes('already exists')) {
            setError('Este correo ya está registrado. Intenta iniciar sesión.')
          } else {
            setError(error.message)
          }
          return
        }
        // In local dev without email confirmation, user is logged in immediately
        setSuccessMessage('¡Cuenta creada! Continuando...')
        setTimeout(() => onSuccess(), 800)
      } else {
        const { error } = await signInWithEmail(email, password)
        if (error) {
          if (error.message.includes('Invalid login') || error.message.includes('invalid credentials')) {
            setError('Correo o contraseña incorrectos')
          } else {
            setError(error.message)
          }
          return
        }
        setSuccessMessage('¡Bienvenido! Continuando...')
        setTimeout(() => onSuccess(), 800)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    clearState()
    setGoogleLoading(true)
    // Guardar intención para restaurar scroll al volver del OAuth redirect
    localStorage.setItem('auth_intent', 'scroll-to-form')
    try {
      const { error } = await signInWithGoogle()
      if (error) {
        localStorage.removeItem('auth_intent')
        setError('Google OAuth no está configurado. Usa correo y contraseña.')
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            {mode === 'signup' ? 'Crea tu cuenta' : 'Inicia sesión'}
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            {mode === 'signup'
              ? 'Guarda tu configuración y accede a tu panel de control'
              : 'Accede para continuar configurando tu agente'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-2">
          {/* Google button */}
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center gap-3 h-11"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            Continuar con Google
          </Button>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-sm text-muted-foreground">o</span>
            <Separator className="flex-1" />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="auth-email">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="auth-email"
                  type="email"
                  placeholder="tu@correo.com"
                  className="pl-9"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearState() }}
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="auth-password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="auth-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  className="pl-9"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearState() }}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md p-3">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-100 rounded-md p-3">
                <span>{successMessage}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 mt-1"
              disabled={loading || googleLoading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <User className="h-4 w-4 mr-2" />
              )}
              {mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión'}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground">
            {mode === 'signup' ? (
              <>
                ¿Ya tienes cuenta?{' '}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => { setMode('login'); clearState() }}
                >
                  Inicia sesión
                </button>
              </>
            ) : (
              <>
                ¿No tienes cuenta?{' '}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => { setMode('signup'); clearState() }}
                >
                  Regístrate gratis
                </button>
              </>
            )}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
