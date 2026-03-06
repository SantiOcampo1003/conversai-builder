import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Mail, X, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'

export function VerifyEmailBanner() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [dismissed, setDismissed] = useState(() => {
    // Persistir dismissal en sessionStorage (solo para la sesión actual)
    return sessionStorage.getItem('email_banner_dismissed') === 'true'
  })
  const [resending, setResending] = useState(false)

  // Verificar si el email ya está confirmado
  const isEmailVerified = user?.email_confirmed_at != null

  // Si el email está verificado o el usuario lo dismissó, no mostrar
  if (isEmailVerified || dismissed || !user) {
    return null
  }

  const handleDismiss = () => {
    setDismissed(true)
    sessionStorage.setItem('email_banner_dismissed', 'true')
  }

  const handleResendEmail = async () => {
    setResending(true)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email!,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`
        }
      })

      if (error) throw error

      toast({
        title: 'Email enviado',
        description: 'Revisa tu bandeja de entrada para verificar tu email.',
      })
    } catch (error: any) {
      toast({
        title: 'Error al enviar email',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setResending(false)
    }
  }

  return (
    <Alert className="mb-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-amber-600 hover:text-amber-800 dark:text-amber-500 dark:hover:text-amber-300 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <Mail className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1">
          <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
            <span className="font-medium">Verifica tu email</span>
            <br />
            Enviamos un email de verificación a <span className="font-semibold">{user.email}</span>.
            Verifica tu cuenta para mayor seguridad.
          </AlertDescription>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={handleResendEmail}
              disabled={resending}
              className="border-amber-600 text-amber-700 hover:bg-amber-100 dark:border-amber-500 dark:text-amber-400 dark:hover:bg-amber-950/40"
            >
              {resending ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Reenviar email'
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-950/40"
            >
              Recordar más tarde
            </Button>
          </div>
        </div>
      </div>
    </Alert>
  )
}
