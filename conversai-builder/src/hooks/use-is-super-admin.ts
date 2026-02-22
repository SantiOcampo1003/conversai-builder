import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

/**
 * Hook para verificar si el usuario actual es super_admin
 * Solo usuarios con dominio @easyagents.space pueden tener este rol
 */
export function useIsSuperAdmin() {
  const { user } = useAuth()

  const { data: isSuperAdmin, isLoading } = useQuery({
    queryKey: ['is-super-admin', user?.id],
    queryFn: async () => {
      if (!user) return false

      // Double check primero: verificar que el email sea @easyagents.space
      if (!user.email?.endsWith('@easyagents.space')) {
        return false
      }

      // Verificar si el usuario tiene rol super_admin
      const { data, error } = await supabase
        .from('client_members')
        .select('role')
        .eq('auth_user_id', user.id)
        .eq('role', 'super_admin')
        .eq('status', 'active')
        .maybeSingle()

      // maybeSingle() retorna null si no hay resultados (sin error)
      if (error) {
        console.error('Error checking super_admin status:', error)
        return false
      }

      // Si data es null o no existe, el usuario NO es super_admin
      return !!data
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: true,
  })

  return {
    isSuperAdmin: isSuperAdmin ?? false,
    isLoading,
  }
}
