import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

/**
 * Hook para obtener el client_id correcto considerando impersonalización
 *
 * Si el super admin está impersonalizando, devuelve el client_id del cliente impersonalizado.
 * Si no, devuelve el client_id del usuario actual.
 */
export function useClientContext() {
  const { user } = useAuth()
  const [clientId, setClientId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isImpersonating, setIsImpersonating] = useState(false)

  useEffect(() => {
    if (!user) {
      setClientId(null)
      setIsLoading(false)
      return
    }

    const loadClientId = async () => {
      setIsLoading(true)

      // Verificar si estamos impersonalizando
      const impersonationData = sessionStorage.getItem('super_admin_impersonating')

      if (impersonationData) {
        try {
          const { targetClientId } = JSON.parse(impersonationData)
          setClientId(targetClientId)
          setIsImpersonating(true)
          setIsLoading(false)
          return
        } catch (error) {
          console.error('Error parsing impersonation data:', error)
          sessionStorage.removeItem('super_admin_impersonating')
        }
      }

      // Si no estamos impersonalizando, obtener el client_id del usuario actual
      const { data: membership } = await supabase
        .from('client_members')
        .select('client_id')
        .eq('auth_user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      setClientId(membership?.client_id || null)
      setIsImpersonating(false)
      setIsLoading(false)
    }

    loadClientId()

    // Escuchar cambios en sessionStorage (por si se cambia la impersonalización)
    const handleStorageChange = () => {
      loadClientId()
    }

    window.addEventListener('storage', handleStorageChange)

    // También escuchar un evento custom para cambios en la misma pestaña
    window.addEventListener('impersonation-changed', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('impersonation-changed', handleStorageChange)
    }
  }, [user])

  return {
    clientId,
    isLoading,
    isImpersonating,
  }
}
