import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [validToken, setValidToken] = useState(false)

  useEffect(() => {
    // Verificar si hay un token de recuperación válido
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()

      // Si hay sesión y viene de recuperación, es válido
      if (data.session) {
        setValidToken(true)
      } else {
        setError('El enlace de recuperación es inválido o ha expirado. Solicita uno nuevo.')
      }
    }

    checkSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validaciones
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error

      setSuccess(true)

      // Redirigir al dashboard después de 2 segundos
      setTimeout(() => {
        navigate('/dashboard')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Error al actualizar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10 -z-10" />

        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              ¡Contraseña actualizada!
            </h2>
            <p className="text-muted-foreground mb-6">
              Tu contraseña ha sido cambiada exitosamente. Redirigiendo al dashboard...
            </p>
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
          </div>
        </div>
      </div>
    )
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
              Nueva contraseña
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Ingresa tu nueva contraseña para tu cuenta
            </p>
          </div>

          {!validToken ? (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-destructive font-medium mb-2">
                  Enlace inválido o expirado
                </p>
                <p className="text-sm text-destructive/80 mb-3">
                  {error}
                </p>
                <Button
                  onClick={() => navigate('/login')}
                  variant="outline"
                  size="sm"
                  className="border-destructive/20 hover:bg-destructive/10"
                >
                  Volver al inicio de sesión
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password" className="text-sm font-medium">
                  Nueva Contraseña
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="mt-1.5 h-11 border-2 bg-secondary/50"
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirmar Contraseña
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña"
                  className="mt-1.5 h-11 border-2 bg-secondary/50"
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/30"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  'Actualizar contraseña'
                )}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          ¿Recordaste tu contraseña?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-primary hover:underline font-medium"
          >
            Inicia sesión
          </button>
        </p>
      </div>
    </div>
  )
}
