import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Bot, MessageSquare, Calendar, Tag, Plus, Loader2, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Agent {
  id: number
  agent_id: string
  business_name: string
  business_category: string | null
  business_type: string | null
  created_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  ropa: 'Ropa y Moda',
  tecnologia: 'Tecnología',
  alimentos: 'Alimentos y Bebidas',
  belleza: 'Belleza y Cuidado Personal',
  hogar: 'Hogar y Decoración',
  'servicios-profesionales': 'Servicios Profesionales',
  salud: 'Salud y Bienestar',
  educacion: 'Educación',
  food: 'Alimentos',
  restaurant: 'Restaurante',
  otro: 'Otro',
}

const CATEGORY_EMOJI: Record<string, string> = {
  ropa: '👗',
  tecnologia: '💻',
  alimentos: '🍽️',
  belleza: '💄',
  hogar: '🏠',
  'servicios-profesionales': '💼',
  salud: '❤️',
  educacion: '📚',
  food: '🍽️',
  restaurant: '🍕',
  otro: '🏷️',
}

export function AgentsSection() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    const fetchAgents = async () => {
      setLoading(true)
      setError(null)

      try {
        // 1. Obtener el client_id del usuario
        const { data: membership, error: memberError } = await supabase
          .from('client_members')
          .select('client_id')
          .eq('auth_user_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .single()

        if (memberError || !membership) {
          setAgents([])
          return
        }

        // 2. Traer los agentes de ese cliente
        const { data: agentsData, error: agentsError } = await supabase
          .from('agents')
          .select('id, agent_id, business_name, business_category, business_type, created_at')
          .eq('client_id', membership.client_id)
          .order('created_at', { ascending: false })

        if (agentsError) {
          setError('Error al cargar los agentes')
          return
        }

        setAgents(agentsData || [])
      } catch (err) {
        setError('Error inesperado al cargar los agentes')
      } finally {
        setLoading(false)
      }
    }

    fetchAgents()
  }, [user])

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agentes</h1>
          <p className="text-muted-foreground text-sm mt-1">Tus agentes de ventas activos</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agentes</h1>
        </div>
        <div className="border-2 border-dashed border-destructive/30 rounded-2xl p-12 flex flex-col items-center gap-3">
          <p className="text-destructive text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agentes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {agents.length === 0
              ? 'Aún no tienes agentes creados'
              : `${agents.length} agente${agents.length > 1 ? 's' : ''} activo${agents.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <Button
          onClick={() => navigate('/')}
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30"
        >
          <Plus className="h-4 w-4" />
          Nuevo agente
        </Button>
      </div>

      {/* Empty state */}
      {agents.length === 0 && (
        <div className="border-2 border-dashed border-border rounded-2xl p-16 flex flex-col items-center justify-center gap-4">
          <div className="bg-primary/10 rounded-full p-5 shadow-lg shadow-primary/20">
            <Bot className="h-10 w-10 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-foreground font-medium">No tienes agentes aún</p>
            <p className="text-muted-foreground text-sm mt-1">
              Crea tu primer agente de ventas para empezar
            </p>
          </div>
          <Button
            onClick={() => navigate('/')}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30 mt-2"
          >
            <Plus className="h-4 w-4" />
            Crear mi primer agente
          </Button>
        </div>
      )}

      {/* Agent cards */}
      {agents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent) => {
            const categoryEmoji = CATEGORY_EMOJI[agent.business_category || ''] || '🤖'
            const categoryLabel = CATEGORY_LABELS[agent.business_category || ''] || agent.business_category || 'Sin categoría'
            const createdAt = new Date(agent.created_at).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })

            return (
              <div
                key={agent.id}
                className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-200"
              >
                {/* Card header */}
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 shadow-sm shadow-primary/20">
                    <span className="text-xl">{categoryEmoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{agent.business_name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">{categoryLabel}</span>
                    </div>
                  </div>
                </div>

                {/* Agent ID */}
                <div className="bg-secondary/50 rounded-lg px-3 py-2">
                  <p className="text-xs text-muted-foreground font-mono truncate">{agent.agent_id}</p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{createdAt}</span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-primary shadow-sm shadow-primary/50" title="Activo" />
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => navigate(`/chat-test?agentId=${agent.agent_id}&mode=preview`)}
                    size="sm"
                    className="w-full gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40 transition-all"
                    variant="ghost"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Probar agente
                  </Button>
                  <Button
                    onClick={() => navigate(`/dashboard/agent/${agent.agent_id}`)}
                    size="sm"
                    className="w-full gap-2 bg-secondary/80 hover:bg-secondary text-foreground border border-border hover:border-border/80 transition-all"
                    variant="ghost"
                  >
                    <Settings2 className="h-4 w-4" />
                    Personalizar agente
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
