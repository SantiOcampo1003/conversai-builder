import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useClientContext } from '@/hooks/use-client-context'
import { supabase } from '@/lib/supabase'
import { Bot, MessageSquare, Users, MessagesSquare, Loader2, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Metrics {
  totalAgents: number
  totalConversations: number
  totalMessages: number
  uniqueUsers: number
}

interface TopAgent {
  agent_id: string
  agent_name: string
  conversations: number
  messages: number
}

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  loading,
}: {
  label: string
  value: number
  icon: React.ElementType
  color: 'primary' | 'violet' | 'emerald' | 'amber'
  loading: boolean
}) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary shadow-primary/20',
    violet: 'bg-violet-500/10 text-violet-400 shadow-violet-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 shadow-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 shadow-amber-500/20',
  }
  const borderMap = {
    primary: 'hover:border-primary/40',
    violet: 'hover:border-violet-500/40',
    emerald: 'hover:border-emerald-500/40',
    amber: 'hover:border-amber-500/40',
  }

  return (
    <div className={cn(
      'bg-card border border-border rounded-2xl p-5 flex items-center gap-4 transition-all duration-200 hover:shadow-lg',
      borderMap[color]
    )}>
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm', colorMap[color])}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        {loading ? (
          <div className="h-7 w-16 bg-secondary animate-pulse rounded mt-1" />
        ) : (
          <p className="text-2xl font-bold text-foreground mt-0.5">
            {value.toLocaleString('es-ES')}
          </p>
        )}
      </div>
    </div>
  )
}

export function OverviewSection() {
  const { user } = useAuth()
  const { clientId, isLoading: loadingClientId } = useClientContext()

  const [metrics, setMetrics] = useState<Metrics>({
    totalAgents: 0,
    totalConversations: 0,
    totalMessages: 0,
    uniqueUsers: 0,
  })
  const [topAgents, setTopAgents] = useState<TopAgent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !clientId || loadingClientId) return

    const fetchData = async () => {
      setLoading(true)

      // 1. Obtener agentes del cliente impersonalizado
      const { data: agentsData } = await supabase
        .from('agents')
        .select('agent_id, business_name')
        .eq('client_id', clientId)

      const agentIds = (agentsData || []).map(a => a.agent_id)
      const totalAgents = agentIds.length

      if (agentIds.length === 0) {
        setMetrics({ totalAgents: 0, totalConversations: 0, totalMessages: 0, uniqueUsers: 0 })
        setTopAgents([])
        setLoading(false)
        return
      }

      // 3. Obtener todo el historial de chat para esos agentes
      const { data: chatData } = await supabase
        .from('chat_history')
        .select('user_id, agent_id, role')
        .in('agent_id', agentIds)

      if (!chatData) {
        setMetrics({ totalAgents, totalConversations: 0, totalMessages: 0, uniqueUsers: 0 })
        setLoading(false)
        return
      }

      // Calcular métricas en cliente
      const conversationKeys = new Set<string>()
      const uniqueUserIds = new Set<string>()
      const agentStats = new Map<string, { conversations: Set<string>; messages: number }>()

      for (const row of chatData) {
        const convKey = `${row.user_id}__${row.agent_id}`
        conversationKeys.add(convKey)
        uniqueUserIds.add(row.user_id)

        if (!agentStats.has(row.agent_id)) {
          agentStats.set(row.agent_id, { conversations: new Set(), messages: 0 })
        }
        const stat = agentStats.get(row.agent_id)!
        stat.conversations.add(convKey)
        stat.messages++
      }

      // Top agentes por conversaciones
      const top: TopAgent[] = Array.from(agentStats.entries())
        .map(([agent_id, stat]) => {
          const agent = agentsData?.find(a => a.agent_id === agent_id)
          return {
            agent_id,
            agent_name: agent?.business_name || agent_id,
            conversations: stat.conversations.size,
            messages: stat.messages,
          }
        })
        .sort((a, b) => b.conversations - a.conversations)
        .slice(0, 5)

      setMetrics({
        totalAgents,
        totalConversations: conversationKeys.size,
        totalMessages: chatData.length,
        uniqueUsers: uniqueUserIds.size,
      })
      setTopAgents(top)
      setLoading(false)
    }

    fetchData()
  }, [user, clientId, loadingClientId])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Panel General</h1>
        <p className="text-muted-foreground text-sm mt-1">Resumen de actividad de tus agentes</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Agentes activos"
          value={metrics.totalAgents}
          icon={Bot}
          color="primary"
          loading={loading}
        />
        <MetricCard
          label="Conversaciones"
          value={metrics.totalConversations}
          icon={MessagesSquare}
          color="violet"
          loading={loading}
        />
        <MetricCard
          label="Mensajes totales"
          value={metrics.totalMessages}
          icon={MessageSquare}
          color="emerald"
          loading={loading}
        />
        <MetricCard
          label="Usuarios únicos"
          value={metrics.uniqueUsers}
          icon={Users}
          color="amber"
          loading={loading}
        />
      </div>

      {/* Top agents table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Top agentes por conversaciones</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : topAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <MessagesSquare className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Sin datos de conversaciones aún</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Table header */}
            <div className="grid grid-cols-12 px-5 py-2.5 text-xs font-medium text-muted-foreground">
              <span className="col-span-1">#</span>
              <span className="col-span-6">Agente</span>
              <span className="col-span-3 text-right">Conversaciones</span>
              <span className="col-span-2 text-right">Mensajes</span>
            </div>

            {topAgents.map((agent, idx) => (
              <div
                key={agent.agent_id}
                className="grid grid-cols-12 px-5 py-3.5 items-center hover:bg-secondary/30 transition-colors"
              >
                {/* Rank */}
                <span className="col-span-1 text-sm font-bold text-muted-foreground">
                  {idx + 1}
                </span>

                {/* Agent name */}
                <div className="col-span-6 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{agent.agent_name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{agent.agent_id}</p>
                  </div>
                </div>

                {/* Conversations */}
                <div className="col-span-3 flex items-center justify-end">
                  <span className="text-sm font-semibold text-foreground">
                    {agent.conversations.toLocaleString('es-ES')}
                  </span>
                </div>

                {/* Messages */}
                <div className="col-span-2 flex items-center justify-end">
                  <span className="text-sm text-muted-foreground">
                    {agent.messages.toLocaleString('es-ES')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
