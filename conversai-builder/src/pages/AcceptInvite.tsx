import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Loader2, CheckCircle, XCircle, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AcceptInvite() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'invalid'>('loading')
  const [message, setMessage] = useState('')
  const [teamName, setTeamName] = useState('')

  const token = searchParams.get('token') || localStorage.getItem('pendingInviteToken')

  useEffect(() => {
    const acceptInvite = async () => {
      if (!token) {
        setStatus('invalid')
        setMessage('Token de invitación inválido')
        return
      }

      if (!user) {
        // Usar RPC para obtener el email sin necesidad de autenticación
        const { data: inviteData } = await supabase
          .rpc('get_invite_email_by_token', { p_token: token })
          .single()

        localStorage.setItem('pendingInviteToken', token)

        if (inviteData?.invite_email) {
          const params = btoa(JSON.stringify({
            email: inviteData.invite_email,
            redirect: '/accept-invite'
          }))
          navigate(`/login?state=${params}`)
        } else {
          const params = btoa(JSON.stringify({ redirect: '/accept-invite' }))
          navigate(`/login?state=${params}`)
        }
        return
      }

      try {
        // Usar RPC para aceptar la invitación (evita problemas de RLS)
        const { data: result, error: rpcError } = await supabase
          .rpc('accept_team_invite', { p_token: token })
          .single()

        if (rpcError) throw rpcError

        if (!result.success) {
          if (result.error === 'invalid') {
            setStatus('invalid')
            setMessage(result.message || 'Esta invitación no es válida o ya fue usada')
          } else if (result.error === 'already_member') {
            setStatus('error')
            setMessage(result.message || 'Ya eres miembro de este equipo')
          } else {
            setStatus('error')
            setMessage(result.message || 'Error al aceptar la invitación')
          }
          return
        }

        localStorage.removeItem('pendingInviteToken')

        setStatus('success')
        setMessage(`¡Bienvenido a ${result.client_name || 'el equipo'}!`)

        setTimeout(() => {
          navigate('/dashboard')
        }, 2000)
      } catch (err) {
        console.error('Error accepting invite:', err)
        setStatus('error')
        setMessage('Error al aceptar la invitación. Por favor intenta de nuevo.')
      }
    }

    acceptInvite()
  }, [token, user, navigate, teamName])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-2">
              Aceptando invitación...
            </h1>
            <p className="text-sm text-muted-foreground">
              Un momento por favor
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">
              {message}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Redirigiendo al dashboard...
            </p>
          </>
        )}

        {(status === 'error' || status === 'invalid') && (
          <>
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-12 w-12 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">
              {status === 'invalid' ? 'Invitación Inválida' : 'Error'}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {message}
            </p>
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              Ir al Dashboard
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
