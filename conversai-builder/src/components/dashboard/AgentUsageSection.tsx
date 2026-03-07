import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useClientContext } from '@/hooks/use-client-context'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  MessageSquare,
  Users,
  Zap,
  UserPlus,
  Calendar,
  Bot,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { format, startOfWeek, endOfWeek, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────────
interface Agent {
  agent_id: string
  business_name: string
}

interface AgentMetrics {
  agent_id: string
  business_name: string
  total_messages: number
  total_conversations: number
  unique_users: number
  tokens_consumed: number
  leads_generated: number
}

interface DateRange {
  from: Date
  to: Date
}

type DateRangePreset = 'today' | 'this_week' | 'last_15' | 'this_month' | 'last_30' | 'custom'

// ── Helper Functions ───────────────────────────────────────────────────────
function getDateRangeFromPreset(preset: DateRangePreset): DateRange {
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)

  switch (preset) {
    case 'today':
      return {
        from: startOfToday,
        to: endOfToday,
      }
    case 'this_week':
      return {
        from: startOfWeek(today, { weekStartsOn: 1 }),
        to: endOfWeek(today, { weekStartsOn: 1 }),
      }
    case 'last_15':
      return {
        from: subDays(today, 15),
        to: today,
      }
    case 'this_month':
      return {
        from: startOfMonth(today),
        to: endOfMonth(today),
      }
    case 'last_30':
      return {
        from: subDays(today, 30),
        to: today,
      }
    default:
      return {
        from: subDays(today, 7),
        to: today,
      }
  }
}

const DATE_PRESETS = [
  { value: 'today' as const, label: 'Hoy' },
  { value: 'this_week' as const, label: 'Esta semana' },
  { value: 'last_15' as const, label: 'Últimos 15 días' },
  { value: 'this_month' as const, label: 'Mes en curso' },
  { value: 'last_30' as const, label: 'Últimos 30 días' },
] as const

// ── Main Component ─────────────────────────────────────────────────────────
export function AgentUsageSection() {
  const { user } = useAuth()
  const { clientId, isLoading: loadingClientId } = useClientContext()

  const [selectedAgent, setSelectedAgent] = useState<string>('all')
  const [datePreset, setDatePreset] = useState<DateRangePreset>('this_month')
  const [dateRange, setDateRange] = useState<DateRange>(getDateRangeFromPreset('this_month'))
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(getDateRangeFromPreset('this_month'))

  // Query para obtener agentes del cliente
  const { data: clientData } = useQuery({
    queryKey: ['client-agents', clientId],
    queryFn: async () => {
      if (!clientId) return null

      const { data: agents } = await supabase
        .from('agents')
        .select('agent_id, business_name')
        .eq('client_id', clientId)
        .order('business_name')

      return {
        clientId: clientId,
        agents: agents || [],
      }
    },
    enabled: !!clientId && !loadingClientId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })

  const agents = clientData?.agents || []

  // Query para métricas con React Query
  const { data: metricsData, isLoading } = useQuery({
    queryKey: [
      'agent-metrics',
      clientId,
      selectedAgent,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
    ],
    queryFn: async () => {
      if (!clientId) return null

      const agentIds = selectedAgent === 'all'
        ? agents.map(a => a.agent_id)
        : [selectedAgent]

      if (agentIds.length === 0) return null

      // 1. Total de mensajes en el rango
      const { data: messagesData } = await supabase
        .from('chat_history')
        .select('id, agent_id, user_id')
        .in('agent_id', agentIds)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())

      const totalMessages = messagesData?.length || 0

      // 2. Conversaciones únicas (user_id + agent_id)
      const conversationsSet = new Set<string>()
      const uniqueUsersSet = new Set<string>()

      messagesData?.forEach(msg => {
        conversationsSet.add(`${msg.agent_id}:${msg.user_id}`)
        uniqueUsersSet.add(msg.user_id)
      })

      const totalConversations = conversationsSet.size
      const uniqueUsers = uniqueUsersSet.size

      // 3. Tokens consumidos
      const { data: tokensData } = await supabase
        .from('token_transactions')
        .select('tokens, agent_id')
        .eq('client_id', clientId)
        .in('agent_id', agentIds)
        .eq('type', 'consumption')
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())

      const tokensConsumed = tokensData?.reduce((sum, t) => sum + Math.abs(t.tokens), 0) || 0

      // 4. Leads generados
      const { data: leadsData } = await supabase
        .from('leads')
        .select('id, agent_id')
        .in('agent_id', agentIds)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())

      const leadsGenerated = leadsData?.length || 0

      // 5. Métricas por agente
      const agentMetricsMap = new Map<string, AgentMetrics>()

      agents.forEach(agent => {
        agentMetricsMap.set(agent.agent_id, {
          agent_id: agent.agent_id,
          business_name: agent.business_name,
          total_messages: 0,
          total_conversations: 0,
          unique_users: 0,
          tokens_consumed: 0,
          leads_generated: 0,
        })
      })

      // Contar mensajes y conversaciones por agente
      messagesData?.forEach(msg => {
        const metric = agentMetricsMap.get(msg.agent_id)
        if (metric) {
          metric.total_messages++
        }
      })

      // Conversaciones y usuarios únicos por agente
      const agentConversations = new Map<string, Set<string>>()
      const agentUsers = new Map<string, Set<string>>()

      messagesData?.forEach(msg => {
        if (!agentConversations.has(msg.agent_id)) {
          agentConversations.set(msg.agent_id, new Set())
          agentUsers.set(msg.agent_id, new Set())
        }
        agentConversations.get(msg.agent_id)?.add(`${msg.agent_id}:${msg.user_id}`)
        agentUsers.get(msg.agent_id)?.add(msg.user_id)
      })

      agentConversations.forEach((convSet, agentId) => {
        const metric = agentMetricsMap.get(agentId)
        if (metric) {
          metric.total_conversations = convSet.size
          metric.unique_users = agentUsers.get(agentId)?.size || 0
        }
      })

      // Tokens por agente
      tokensData?.forEach((t) => {
        if (t.agent_id) {
          const metric = agentMetricsMap.get(t.agent_id)
          if (metric) {
            metric.tokens_consumed += Math.abs(t.tokens)
          }
        }
      })

      // Leads por agente
      leadsData?.forEach((lead) => {
        if (lead.agent_id) {
          const metric = agentMetricsMap.get(lead.agent_id)
          if (metric) {
            metric.leads_generated++
          }
        }
      })

      // Filtrar solo agentes con actividad y ordenar por mensajes
      const agentMetricsArray = Array.from(agentMetricsMap.values())
        .filter(m => selectedAgent === 'all' ? m.total_messages > 0 : m.agent_id === selectedAgent)
        .sort((a, b) => b.total_messages - a.total_messages)

      return {
        metrics: {
          total_messages: totalMessages,
          total_conversations: totalConversations,
          unique_users: uniqueUsers,
          tokens_consumed: tokensConsumed,
          leads_generated: leadsGenerated,
        },
        agentMetrics: agentMetricsArray,
      }
    },
    enabled: !!clientId && agents.length > 0,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })

  const metrics = metricsData?.metrics || {
    total_messages: 0,
    total_conversations: 0,
    unique_users: 0,
    tokens_consumed: 0,
    leads_generated: 0,
  }

  const agentMetrics = metricsData?.agentMetrics || []
  const loading = isLoading

  const handlePresetChange = (preset: DateRangePreset) => {
    setDatePreset(preset)
    const range = getDateRangeFromPreset(preset)
    setDateRange(range)
    setCustomDateRange(range)
  }

  const handleCustomDateChange = (range: DateRange | undefined) => {
    setCustomDateRange(range)
    if (range?.from && range?.to) {
      setDatePreset('custom')
      setDateRange(range)
    }
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-ES').format(num)
  }

  if (loading && !clientId) {
    return (
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Uso de Agentes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Métricas y estadísticas de tus agentes de IA
          </p>
        </div>

        {/* Filters Skeleton */}
        <div className="flex flex-wrap gap-3">
          <div className="h-10 w-60 bg-secondary rounded-lg animate-pulse" />
          <div className="h-10 w-80 bg-secondary rounded-lg animate-pulse" />
        </div>

        {/* Summary Cards Skeleton */}
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-secondary animate-pulse" />
                <div className="h-4 w-28 bg-secondary rounded animate-pulse" />
              </div>
              <div className="h-8 w-20 bg-secondary rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Chart Skeleton */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="h-6 w-40 bg-secondary rounded animate-pulse mb-4" />
          <div className="h-64 bg-secondary/30 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Uso de Agentes</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Métricas y estadísticas de tus agentes de IA
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        {/* Filtro por agente */}
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-[240px]">
            <Bot className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Seleccionar agente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los agentes</SelectItem>
            {agents.map(agent => (
              <SelectItem key={agent.agent_id} value={agent.agent_id}>
                {agent.business_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filtro de rango de fecha con presets integrados */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[320px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {customDateRange?.from ? (
                customDateRange.to ? (
                  <>
                    {format(customDateRange.from, 'dd MMM yyyy', { locale: es })} -{' '}
                    {format(customDateRange.to, 'dd MMM yyyy', { locale: es })}
                  </>
                ) : (
                  format(customDateRange.from, 'dd MMM yyyy', { locale: es })
                )
              ) : (
                <span>Seleccionar rango de fechas</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex">
              {/* Presets sidebar */}
              <div className="border-r border-border px-2 py-2 space-y-0.5">
                <div className="text-[10px] font-medium text-muted-foreground mb-1 px-1.5">
                  RANGO
                </div>
                {DATE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => handlePresetChange(preset.value)}
                    className={cn(
                      'w-full text-left px-1.5 py-1 text-xs rounded hover:bg-accent transition-colors whitespace-nowrap',
                      datePreset === preset.value && 'bg-accent font-medium'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Calendar */}
              <div className="p-2">
                <CalendarComponent
                  mode="range"
                  selected={customDateRange}
                  onSelect={handleCustomDateChange}
                  numberOfMonths={1}
                  locale={es}
                  className="scale-90"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Métricas principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Total de mensajes */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Mensajes</span>
          </div>
          <p className="text-3xl font-bold text-foreground">
            {formatNumber(metrics.total_messages)}
          </p>
        </div>

        {/* Conversaciones */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Conversaciones</span>
          </div>
          <p className="text-3xl font-bold text-foreground">
            {formatNumber(metrics.total_conversations)}
          </p>
        </div>

        {/* Usuarios únicos */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Usuarios únicos</span>
          </div>
          <p className="text-3xl font-bold text-foreground">
            {formatNumber(metrics.unique_users)}
          </p>
        </div>

        {/* Tokens consumidos */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Tokens</span>
          </div>
          <p className="text-3xl font-bold text-foreground">
            {formatNumber(metrics.tokens_consumed)}
          </p>
        </div>

        {/* Leads generados */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-rose-600" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Leads</span>
          </div>
          <p className="text-3xl font-bold text-foreground">
            {formatNumber(metrics.leads_generated)}
          </p>
        </div>
      </div>

      {/* Tabla de métricas por agente */}
      {agentMetrics.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Desglose por Agente</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 text-xs font-medium text-muted-foreground">Agente</th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground text-right">
                    Mensajes
                  </th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground text-right">
                    Conversaciones
                  </th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground text-right">
                    Usuarios
                  </th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground text-right">
                    Tokens
                  </th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground text-right">
                    Leads
                  </th>
                </tr>
              </thead>
              <tbody>
                {agentMetrics.map((metric, index) => (
                  <tr
                    key={metric.agent_id}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white',
                            index === 0 && 'bg-gradient-to-br from-yellow-400 to-yellow-600',
                            index === 1 && 'bg-gradient-to-br from-gray-300 to-gray-500',
                            index === 2 && 'bg-gradient-to-br from-orange-400 to-orange-600',
                            index > 2 && 'bg-gradient-to-br from-primary to-primary/70'
                          )}
                        >
                          {index + 1}
                        </div>
                        <span className="font-medium text-foreground">{metric.business_name}</span>
                      </div>
                    </td>
                    <td className="py-4 text-right text-sm text-foreground">
                      {formatNumber(metric.total_messages)}
                    </td>
                    <td className="py-4 text-right text-sm text-foreground">
                      {formatNumber(metric.total_conversations)}
                    </td>
                    <td className="py-4 text-right text-sm text-foreground">
                      {formatNumber(metric.unique_users)}
                    </td>
                    <td className="py-4 text-right text-sm text-foreground">
                      {formatNumber(metric.tokens_consumed)}
                    </td>
                    <td className="py-4 text-right text-sm text-foreground">
                      {formatNumber(metric.leads_generated)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Gráficas */}
      {agentMetrics.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Gráfico de Tokens por Agente */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-foreground">Tokens por Agente</h2>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={agentMetrics.slice(0, 10).map((metric) => ({
                  name: metric.business_name.length > 15
                    ? metric.business_name.substring(0, 15) + '...'
                    : metric.business_name,
                  tokens: metric.tokens_consumed,
                }))}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => formatNumber(value)}
                />
                <Bar dataKey="tokens" radius={[8, 8, 0, 0]}>
                  {agentMetrics.slice(0, 10).map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        index === 0
                          ? '#f59e0b'
                          : index === 1
                          ? '#fb923c'
                          : index === 2
                          ? '#fdba74'
                          : '#10b981'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de Mensajes por Agente */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-foreground">Mensajes por Agente</h2>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={agentMetrics.slice(0, 10).map((metric) => ({
                  name: metric.business_name.length > 15
                    ? metric.business_name.substring(0, 15) + '...'
                    : metric.business_name,
                  mensajes: metric.total_messages,
                }))}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => formatNumber(value)}
                />
                <Bar dataKey="mensajes" radius={[8, 8, 0, 0]}>
                  {agentMetrics.slice(0, 10).map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        index === 0
                          ? '#3b82f6'
                          : index === 1
                          ? '#60a5fa'
                          : index === 2
                          ? '#93c5fd'
                          : '#10b981'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de Conversaciones por Agente */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-semibold text-foreground">
                Conversaciones por Agente
              </h2>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={agentMetrics.slice(0, 10).map((metric) => ({
                  name: metric.business_name.length > 15
                    ? metric.business_name.substring(0, 15) + '...'
                    : metric.business_name,
                  conversaciones: metric.total_conversations,
                }))}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => formatNumber(value)}
                />
                <Bar dataKey="conversaciones" radius={[8, 8, 0, 0]}>
                  {agentMetrics.slice(0, 10).map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        index === 0
                          ? '#10b981'
                          : index === 1
                          ? '#34d399'
                          : index === 2
                          ? '#6ee7b7'
                          : '#10b981'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de Pie - Distribución de Mensajes */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-foreground">
                Distribución de Actividad
              </h2>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={agentMetrics.slice(0, 5).map((metric, index) => ({
                    name: metric.business_name,
                    value: metric.total_messages,
                    color: [
                      '#10b981',
                      '#3b82f6',
                      '#f59e0b',
                      '#a855f7',
                      '#ef4444',
                    ][index],
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name.length > 12 ? name.substring(0, 12) + '...' : name} ${(
                      percent * 100
                    ).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {agentMetrics.slice(0, 5).map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        ['#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444'][index]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => formatNumber(value)}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && agentMetrics.length === 0 && (
        <div className="border-2 border-dashed border-border rounded-2xl p-16 flex flex-col items-center justify-center gap-4">
          <div className="bg-primary/10 rounded-full p-5 shadow-lg shadow-primary/20">
            <BarChart3 className="h-10 w-10 text-primary" />
          </div>
          <p className="text-muted-foreground text-center max-w-xs">
            No hay actividad en el rango de fechas seleccionado
          </p>
        </div>
      )}
    </div>
  )
}
