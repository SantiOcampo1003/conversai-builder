import { useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

const IMPERSONATION_KEY = 'super_admin_impersonating'

// Cambios de impersonalización: otra pestaña (`storage`) o esta misma (`impersonation-changed`)
function subscribeImpersonation(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener('impersonation-changed', onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener('impersonation-changed', onChange)
  }
}

const readImpersonation = () => sessionStorage.getItem(IMPERSONATION_KEY)

/**
 * Hook para obtener el client_id correcto considerando impersonalización
 *
 * Si el super admin está impersonalizando, devuelve el client_id del cliente impersonalizado.
 * Si no, devuelve el client_id del usuario actual.
 *
 * El resultado se comparte en caché entre todas las secciones: navegar o volver a la pestaña
 * no lo vuelve a poner en "cargando".
 */
export function useClientContext() {
  const { user } = useAuth()
  const impersonationRaw = useSyncExternalStore(subscribeImpersonation, readImpersonation)

  const { data, isPending } = useQuery({
    queryKey: ['client-context', user?.id, impersonationRaw],
    enabled: !!user,
    staleTime: Infinity,
    queryFn: async () => {
      if (impersonationRaw) {
        try {
          const { targetClientId } = JSON.parse(impersonationRaw)
          return { clientId: targetClientId as string, isImpersonating: true }
        } catch (error) {
          console.error('Error parsing impersonation data:', error)
          sessionStorage.removeItem(IMPERSONATION_KEY)
        }
      }

      const { data: membership } = await supabase
        .from('client_members')
        .select('client_id')
        .eq('auth_user_id', user!.id)
        .eq('status', 'active')
        .maybeSingle()

      return { clientId: (membership?.client_id as string | undefined) ?? null, isImpersonating: false }
    },
  })

  return {
    clientId: user ? data?.clientId ?? null : null,
    isLoading: !!user && isPending,
    isImpersonating: user ? data?.isImpersonating ?? false : false,
  }
}
