import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useClientContext } from '@/hooks/use-client-context'
import { supabase } from '@/lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Zap,
  TrendingDown,
  TrendingUp,
  ShoppingCart,
  Clock,
  Bot,
  CircleDollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
  Gift,
  RotateCcw,
  Loader2,
  AlertCircle,
  Package,
  CheckCircle2,
  XCircle,
  Eye,
  Calendar,
  CreditCard,
  RefreshCw,
  FileText,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ── Types ──────────────────────────────────────────────────────────────────
interface TokenBalance {
  id: string
  client_id: string
  total_tokens: number
  used_tokens: number
  available_tokens: number
  is_active: boolean
  low_balance_notified: boolean
  last_recharge_at: string | null
}

interface TokenTransaction {
  id: string
  client_id: string
  agent_id: string | null
  package_id: string | null
  type: 'purchase' | 'consumption' | 'bonus' | 'refund'
  tokens: number
  amount_cop: number | null
  payment_status: string | null
  description: string | null
  metadata: any
  created_at: string
  cancelled_at: string | null
  payment_link: string | null
  payment_expires_at: string | null
}

interface TokenPackage {
  id: string
  name: string
  display_name: string
  tokens: number
  price_cop: number
  price_usd: number | null
  description: string | null
  conversations_approx: number | null
  active: boolean
  sort_order: number
}

interface AgentUsage {
  agent_id: string
  business_name: string
  tokens_used: number
}

interface ServiceOrder {
  id: string
  service_id: string
  custom_description: string | null
  price_cop: number
  price_usd: number | null
  payment_status: 'pending' | 'paid' | 'cancelled' | 'refunded'
  service_status: 'not_started' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold'
  created_at: string
  paid_at?: string | null
  updated_at?: string | null
  attachment_url?: string | null
  service?: {
    display_name: string
    description: string
  }
}

// ── Transaction Icon ───────────────────────────────────────────────────────
function TransactionIcon({ type }: { type: TokenTransaction['type'] }) {
  const config = {
    purchase: { icon: ArrowUpCircle, className: 'text-green-600 bg-green-500/10' },
    consumption: { icon: ArrowDownCircle, className: 'text-red-600 bg-red-500/10' },
    bonus: { icon: Gift, className: 'text-purple-600 bg-purple-500/10' },
    refund: { icon: RotateCcw, className: 'text-blue-600 bg-blue-500/10' },
  }

  const { icon: Icon, className } = config[type]

  return (
    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', className)}>
      <Icon className="h-4 w-4" />
    </div>
  )
}

// ── Transaction Type Badge ─────────────────────────────────────────────────
function TransactionTypeBadge({ type }: { type: TokenTransaction['type'] }) {
  const config = {
    purchase: { label: 'Compra', className: 'bg-green-500/10 text-green-700 border-green-500/20' },
    consumption: { label: 'Consumo', className: 'bg-red-500/10 text-red-700 border-red-500/20' },
    bonus: { label: 'Bonus', className: 'bg-purple-500/10 text-purple-700 border-purple-500/20' },
    refund: { label: 'Reembolso', className: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  }

  const { label, className } = config[type]

  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', className)}>
      {label}
    </span>
  )
}

// ── Payment Status Badge ───────────────────────────────────────────────────
function PaymentStatusBadge({
  type,
  paymentStatus
}: {
  type: TokenTransaction['type']
  paymentStatus: string | null
}) {
  // Solo mostrar estado para transacciones de compra
  if (type !== 'purchase') {
    return <span className="text-xs text-muted-foreground">-</span>
  }

  const config = {
    pending: {
      label: 'Pendiente',
      className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
      icon: Loader2,
      animate: true
    },
    approved: {
      label: 'Confirmado',
      className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
      icon: ArrowUpCircle,
      animate: false
    },
    rejected: {
      label: 'Rechazado',
      className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
      icon: AlertCircle,
      animate: false
    },
    cancelled: {
      label: 'Cancelado',
      className: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20',
      icon: XCircle,
      animate: false
    },
  }

  const status = (paymentStatus || 'pending') as keyof typeof config
  const { label, className, icon: Icon, animate } = config[status] || config.pending

  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border inline-flex items-center gap-1', className)}>
      <Icon className={cn('h-3 w-3', animate && 'animate-spin')} />
      {label}
    </span>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export function TokensSection() {
  const { user } = useAuth()
  const { clientId } = useClientContext()
  const queryClient = useQueryClient()
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [payingService, setPayingService] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [selectedService, setSelectedService] = useState<ServiceOrder | null>(null)

  // Filters and pagination for transactions
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>('all')
  const [transactionDateFilter, setTransactionDateFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Query para datos de tokens
  const { data: tokensData, isLoading } = useQuery({
    queryKey: ['tokens-data', clientId],
    queryFn: async () => {
      if (!clientId) return null

      // Obtener balance de tokens
      const { data: balanceData } = await supabase
        .from('token_balances')
        .select('*')
        .eq('client_id', clientId)
        .single()

      // Obtener transacciones (últimas 50)
      const { data: transactionsData } = await supabase
        .from('token_transactions')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(50)

      // Obtener paquetes activos
      const { data: packagesData } = await supabase
        .from('token_packages')
        .select('*')
        .eq('active', true)
        .order('sort_order')

      // Obtener órdenes de servicio del cliente
      const { data: serviceOrdersData, error: serviceOrdersError } = await supabase
        .from('service_orders')
        .select(`
          *,
          service:services(display_name, description)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

      if (serviceOrdersError) {
        console.error('Error fetching service orders:', serviceOrdersError)
      }

      console.log('🔍 DEBUG - Client ID:', clientId)
      console.log('🔍 DEBUG - Service Orders:', serviceOrdersData)
      console.log('🔍 DEBUG - Service Orders Count:', serviceOrdersData?.length || 0)

      // Calcular uso por agente
      const { data: agentsData } = await supabase
        .from('agents')
        .select('agent_id, business_name')
        .eq('client_id', clientId)

      const usage: AgentUsage[] = []

      if (agentsData) {
        for (const agent of agentsData) {
          const { data: consumptionData } = await supabase
            .from('token_transactions')
            .select('tokens')
            .eq('client_id', clientId)
            .eq('agent_id', agent.agent_id)
            .eq('type', 'consumption')

          const totalUsed = consumptionData?.reduce((sum, t) => sum + Math.abs(t.tokens), 0) || 0

          if (totalUsed > 0) {
            usage.push({
              agent_id: agent.agent_id,
              business_name: agent.business_name,
              tokens_used: totalUsed,
            })
          }
        }

        usage.sort((a, b) => b.tokens_used - a.tokens_used)
      }

      return {
        clientId,
        balance: balanceData,
        transactions: transactionsData || [],
        packages: packagesData || [],
        agentUsage: usage,
        serviceOrders: serviceOrdersData || [],
      }
    },
    enabled: !!clientId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // Actualizar cada 1 minuto automáticamente
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })

  const balance = tokensData?.balance || null
  const allTransactions = tokensData?.transactions || []
  const packages = tokensData?.packages || []
  const agentUsage = tokensData?.agentUsage || []
  const serviceOrders = (tokensData?.serviceOrders || []) as ServiceOrder[]
  const loading = isLoading

  // Filter transactions
  const filteredTransactions = allTransactions.filter((tx) => {
    // Type filter
    if (transactionTypeFilter !== 'all' && tx.type !== transactionTypeFilter) {
      return false
    }

    // Date filter
    if (transactionDateFilter !== 'all') {
      const txDate = new Date(tx.created_at)
      const now = new Date()

      switch (transactionDateFilter) {
        case 'today':
          return txDate.toDateString() === now.toDateString()
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          return txDate >= weekAgo
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          return txDate >= monthAgo
        case 'year':
          const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          return txDate >= yearAgo
        default:
          return true
      }
    }

    return true
  })

  // Paginate transactions
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Update pending transactions to use allTransactions instead of transactions
  const transactions = allTransactions

  // Debug: log serviceOrders in component
  console.log('🎨 RENDER - serviceOrders:', serviceOrders)
  console.log('🎨 RENDER - serviceOrders.length:', serviceOrders.length)
  console.log('🎨 RENDER - Will show section?', serviceOrders.length > 0)

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-ES').format(num)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const usagePercentage = balance
    ? Math.round((balance.used_tokens / balance.total_tokens) * 100)
    : 0

  // Filtrar transacciones pendientes
  const pendingTransactions = transactions.filter(
    (tx) => tx.type === 'purchase' && tx.payment_status === 'pending'
  )

  const handlePurchase = async (packageId: string) => {
    if (!clientId) {
      console.error('Client ID not found')
      return
    }

    try {
      setPurchasing(packageId)

      const webhookUrl = import.meta.env.VITE_N8N_CREATE_PAYMENT_WEBHOOK

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          type: 'token',
          clientId,
          packageId,
        }),
      })

      if (!response.ok) {
        throw new Error('Error al crear el pago')
      }

      const data = await response.json()
      console.log('Payment response:', data)

      // Invalidar cache antes de redirigir (para cuando regrese)
      await queryClient.invalidateQueries({ queryKey: ['tokens-data'] })

      // Redirigir a MercadoPago
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      }
    } catch (err) {
      console.error('Error purchasing package:', err)
      alert('Error al procesar el pago. Por favor intenta de nuevo.')
    } finally {
      setPurchasing(null)
    }
  }

  const handlePayService = async (order: ServiceOrder) => {
    if (!clientId || !user) {
      console.error('Client ID or user not found')
      return
    }

    try {
      setPayingService(order.id)

      const webhookUrl = import.meta.env.VITE_N8N_CREATE_PAYMENT_WEBHOOK

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          type: 'service',
          serviceOrderId: order.id,
        }),
      })

      if (!response.ok) {
        throw new Error('Error al crear el pago')
      }

      const data = await response.json()
      console.log('Service payment response:', data)

      // Invalidar cache antes de redirigir (para cuando regrese)
      await queryClient.invalidateQueries({ queryKey: ['tokens-data'] })

      // Redirigir a MercadoPago
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      }
    } catch (err) {
      console.error('Error paying service:', err)
      alert('Error al procesar el pago del servicio. Por favor intenta de nuevo.')
    } finally {
      setPayingService(null)
    }
  }

  const handleRetryPayment = async (transactionId: string) => {
    if (!clientId || !user) {
      console.error('Client ID or user not found')
      return
    }

    try {
      setRetrying(transactionId)

      const webhookUrl = import.meta.env.VITE_N8N_CREATE_PAYMENT_WEBHOOK

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'retry',
          transactionId,
        }),
      })

      if (!response.ok) {
        throw new Error('Error al reintentar el pago')
      }

      const data = await response.json()
      console.log('Retry payment response:', data)

      // Invalidar cache antes de redirigir
      await queryClient.invalidateQueries({ queryKey: ['tokens-data'] })

      // Redirigir a MercadoPago
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      }
    } catch (err) {
      console.error('Error retrying payment:', err)
      alert('Error al reintentar el pago. Por favor intenta de nuevo.')
    } finally {
      setRetrying(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tokens</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestiona tu balance y consumo de tokens
          </p>
        </div>

        {/* Balance Cards Skeleton */}
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-secondary animate-pulse" />
                <div className="h-4 w-32 bg-secondary rounded animate-pulse" />
              </div>
              <div className="h-9 w-24 bg-secondary rounded animate-pulse mb-2" />
              <div className="h-3 w-20 bg-secondary/50 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Tabs Skeleton */}
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-32 bg-secondary rounded-lg animate-pulse" />
          ))}
        </div>

        {/* Content Skeleton */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 w-40 bg-secondary rounded animate-pulse" />
                    <div className="h-3 w-24 bg-secondary/50 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-6 w-20 bg-secondary rounded-full animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!balance) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tokens</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Aún no tienes tokens configurados
          </p>
        </div>
        <div className="border-2 border-dashed border-border rounded-2xl p-16 flex flex-col items-center justify-center gap-4">
          <div className="bg-primary/10 rounded-full p-5 shadow-lg shadow-primary/20">
            <Zap className="h-10 w-10 text-primary" />
          </div>
          <p className="text-muted-foreground text-center max-w-xs">
            Contacta con soporte para activar tokens en tu cuenta
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tokens</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestiona tu balance y consumo de tokens
        </p>
      </div>

      {/* Pending Payments Alert */}
      {pendingTransactions.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-500/30 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Pago en proceso
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Pendiente
                </span>
              </div>
              <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                Tienes {pendingTransactions.length} {pendingTransactions.length === 1 ? 'pago pendiente' : 'pagos pendientes'} de confirmación.
                Los tokens se acreditarán automáticamente cuando se confirme el pago.
              </p>
              <div className="space-y-2">
                {pendingTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-white/50 dark:bg-black/20 rounded-lg p-3 border border-amber-500/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShoppingCart className="h-4 w-4 text-amber-600" />
                        <div>
                          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                            {tx.tokens} tokens
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            {formatDate(tx.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                          {tx.amount_cop ? formatCurrency(tx.amount_cop) : 'N/A'}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Esperando confirmación
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['tokens-data'] })}
              className="flex-shrink-0 p-2 hover:bg-amber-500/10 rounded-lg transition-colors"
              title="Actualizar estado"
            >
              <RotateCcw className="h-4 w-4 text-amber-600" />
            </button>
          </div>
        </div>
      )}

      {/* Balance Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Tokens Disponibles */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.5))]" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                Tokens Disponibles
              </span>
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">
              {formatNumber(balance.available_tokens)}
            </p>
            <p className="text-xs text-muted-foreground">
              de {formatNumber(balance.total_tokens)} totales
            </p>
          </div>
        </div>

        {/* Tokens Usados */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Tokens Usados</span>
          </div>
          <p className="text-3xl font-bold text-foreground mb-1">
            {formatNumber(balance.used_tokens)}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-red-600 h-full transition-all duration-500"
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground font-medium">{usagePercentage}%</span>
          </div>
        </div>

        {/* Última Recarga */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Última Recarga</span>
          </div>
          <p className="text-lg font-semibold text-foreground">
            {balance.last_recharge_at
              ? formatDate(balance.last_recharge_at)
              : 'Sin recargas aún'}
          </p>
          {balance.low_balance_notified && (
            <div className="mt-2 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 inline-block">
              ⚠️ Saldo bajo
            </div>
          )}
        </div>
      </div>

      {/* Uso por Agente */}
      {agentUsage.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bot className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Uso por Agente</h2>
          </div>

          <div className="space-y-3">
            {agentUsage.map((agent, index) => {
              const percentage = balance
                ? Math.round((agent.tokens_used / balance.used_tokens) * 100)
                : 0

              return (
                <div key={agent.agent_id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
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
                      <span className="font-medium text-foreground">{agent.business_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">
                        {formatNumber(agent.tokens_used)}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground w-12 text-right">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all duration-500',
                        index === 0 && 'bg-gradient-to-r from-yellow-400 to-yellow-600',
                        index === 1 && 'bg-gradient-to-r from-gray-300 to-gray-500',
                        index === 2 && 'bg-gradient-to-r from-orange-400 to-orange-600',
                        index > 2 && 'bg-gradient-to-r from-primary to-primary/70'
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Paquetes Disponibles */}
      {packages.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Paquetes Disponibles</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors"
              >
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-foreground mb-1">{pkg.display_name}</h3>
                  {pkg.description && (
                    <p className="text-xs text-muted-foreground">{pkg.description}</p>
                  )}
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-3xl font-bold text-primary">
                      {formatNumber(pkg.tokens)}
                    </span>
                    <span className="text-sm text-muted-foreground">tokens</span>
                  </div>
                  {pkg.conversations_approx && (
                    <p className="text-xs text-muted-foreground">
                      ≈ {formatNumber(pkg.conversations_approx)} conversaciones
                    </p>
                  )}
                </div>

                <div className="mb-4 pb-4 border-b border-border">
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(pkg.price_cop)}
                  </p>
                  {pkg.price_usd && (
                    <p className="text-xs text-muted-foreground">
                      ≈ ${pkg.price_usd.toFixed(2)} USD
                    </p>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={purchasing === pkg.id}
                >
                  <CircleDollarSign className="h-4 w-4 mr-2" />
                  {purchasing === pkg.id ? 'Procesando...' : 'Comprar'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Servicios Profesionales */}
      {serviceOrders.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-4 border-purple-500 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Package className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-bold text-purple-900 dark:text-purple-100">🚀 SERVICIOS PROFESIONALES 🚀</h2>
          </div>

          <div className="space-y-3">
            {serviceOrders.map((order) => {
              const isPending = order.payment_status === 'pending'
              const isCompleted = order.service_status === 'completed'

              return (
                <div
                  key={order.id}
                  className={cn(
                    'border rounded-lg p-4',
                    isPending && 'border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/10'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">
                          {order.service?.display_name}
                        </h3>
                        {isCompleted && (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        )}
                      </div>
                      {order.custom_description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {order.custom_description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Payment Status Badge */}
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium border inline-flex items-center gap-1',
                            order.payment_status === 'pending' &&
                              'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
                            order.payment_status === 'paid' &&
                              'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
                            order.payment_status === 'cancelled' &&
                              'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'
                          )}
                        >
                          {order.payment_status === 'pending' && (
                            <>
                              <Clock className="h-3 w-3 animate-spin" />
                              Pago pendiente
                            </>
                          )}
                          {order.payment_status === 'paid' && (
                            <>
                              <CheckCircle2 className="h-3 w-3" />
                              Pagado
                            </>
                          )}
                          {order.payment_status === 'cancelled' && (
                            <>
                              <XCircle className="h-3 w-3" />
                              Cancelado
                            </>
                          )}
                        </span>

                        {/* Service Status Badge */}
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium border',
                            order.service_status === 'not_started' &&
                              'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20',
                            order.service_status === 'in_progress' &&
                              'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
                            order.service_status === 'completed' &&
                              'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
                            order.service_status === 'on_hold' &&
                              'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                          )}
                        >
                          {order.service_status === 'not_started' && 'No iniciado'}
                          {order.service_status === 'in_progress' && 'En progreso'}
                          {order.service_status === 'completed' && 'Completado'}
                          {order.service_status === 'on_hold' && 'En espera'}
                          {order.service_status === 'cancelled' && 'Cancelado'}
                        </span>

                        <span className="text-xs text-muted-foreground">
                          {formatDate(order.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-lg font-semibold text-foreground">
                          {formatCurrency(order.price_cop)}
                        </div>
                        {order.price_usd && (
                          <div className="text-xs text-muted-foreground">
                            ${order.price_usd} USD
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 w-full min-w-[120px]">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedService(order)}
                          className="w-full"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver detalles
                        </Button>
                        {isPending && (
                          <Button
                            size="sm"
                            onClick={() => handlePayService(order)}
                            disabled={payingService === order.id}
                            className="w-full"
                          >
                            {payingService === order.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Procesando...
                              </>
                            ) : (
                              <>
                                <CircleDollarSign className="h-4 w-4 mr-2" />
                                Pagar ahora
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Historial de Transacciones */}
      {allTransactions.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Historial de Transacciones</h2>
            </div>
            <span className="text-sm text-muted-foreground">
              {filteredTransactions.length} {filteredTransactions.length === 1 ? 'transacción' : 'transacciones'}
            </span>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Tipo de Transacción
              </label>
              <Select value={transactionTypeFilter} onValueChange={(value) => {
                setTransactionTypeFilter(value)
                setCurrentPage(1)
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="purchase">Compra</SelectItem>
                  <SelectItem value="consumption">Consumo</SelectItem>
                  <SelectItem value="bonus">Bonus</SelectItem>
                  <SelectItem value="refund">Reembolso</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Periodo
              </label>
              <Select value={transactionDateFilter} onValueChange={(value) => {
                setTransactionDateFilter(value)
                setCurrentPage(1)
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todo el tiempo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo el tiempo</SelectItem>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="week">Última semana</SelectItem>
                  <SelectItem value="month">Último mes</SelectItem>
                  <SelectItem value="year">Último año</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-muted/50 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No se encontraron transacciones con los filtros seleccionados
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 text-xs font-medium text-muted-foreground">Fecha</th>
                      <th className="pb-3 text-xs font-medium text-muted-foreground">Tipo</th>
                      <th className="pb-3 text-xs font-medium text-muted-foreground">Agente</th>
                      <th className="pb-3 text-xs font-medium text-muted-foreground">Estado</th>
                      <th className="pb-3 text-xs font-medium text-muted-foreground text-right">
                        Tokens
                      </th>
                      <th className="pb-3 text-xs font-medium text-muted-foreground text-right">
                        Monto
                      </th>
                      <th className="pb-3 text-xs font-medium text-muted-foreground text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransactions.map((tx) => {
                      const isPending = tx.type === 'purchase' && tx.payment_status === 'pending'

                      return (
                        <tr
                          key={tx.id}
                          className={cn(
                            'border-b border-border/50 last:border-0',
                            isPending && 'bg-amber-50/50 dark:bg-amber-950/10'
                          )}
                        >
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <TransactionIcon type={tx.type} />
                              <span className="text-sm text-muted-foreground">
                                {formatDate(tx.created_at)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3">
                            <TransactionTypeBadge type={tx.type} />
                          </td>
                          <td className="py-3">
                            <span className="text-sm text-foreground">
                              {tx.agent_id || tx.description || '-'}
                            </span>
                          </td>
                          <td className="py-3">
                            <PaymentStatusBadge type={tx.type} paymentStatus={tx.payment_status} />
                          </td>
                          <td className="py-3 text-right">
                            <span
                              className={cn(
                                'text-sm font-medium',
                                tx.type === 'consumption' && 'text-red-600',
                                tx.type === 'purchase' && !isPending && 'text-green-600',
                                tx.type === 'purchase' && isPending && 'text-amber-600',
                                tx.type === 'bonus' && 'text-purple-600',
                                tx.type === 'refund' && 'text-blue-600'
                              )}
                            >
                              {tx.type === 'consumption' ? '-' : '+'}
                              {formatNumber(Math.abs(tx.tokens))}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <span className="text-sm text-muted-foreground">
                              {tx.amount_cop ? formatCurrency(tx.amount_cop) : '-'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            {isPending && !tx.cancelled_at && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRetryPayment(tx.id)}
                                disabled={retrying === tx.id}
                                className="h-8 text-xs"
                              >
                                {retrying === tx.id ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Procesando...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Reintentar
                                  </>
                                )}
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Service Detail Dialog */}
      <Dialog open={!!selectedService} onOpenChange={(open) => !open && setSelectedService(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedService && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-purple-600" />
                  {selectedService.service?.display_name || 'Servicio Profesional'}
                </DialogTitle>
                <DialogDescription>
                  Detalles de tu orden de servicio profesional
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Descripción */}
                {selectedService.custom_description && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-2">Descripción</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedService.custom_description}
                    </p>
                  </div>
                )}

                {/* Estados */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-semibold text-foreground">Estado de Pago</h4>
                    </div>
                    <span
                      className={cn(
                        'px-3 py-1 rounded-full text-sm font-medium border inline-flex items-center gap-1.5',
                        selectedService.payment_status === 'pending' &&
                          'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
                        selectedService.payment_status === 'paid' &&
                          'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
                        selectedService.payment_status === 'cancelled' &&
                          'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'
                      )}
                    >
                      {selectedService.payment_status === 'pending' && (
                        <>
                          <Clock className="h-3.5 w-3.5" />
                          Pendiente
                        </>
                      )}
                      {selectedService.payment_status === 'paid' && (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Pagado
                        </>
                      )}
                      {selectedService.payment_status === 'cancelled' && (
                        <>
                          <XCircle className="h-3.5 w-3.5" />
                          Cancelado
                        </>
                      )}
                    </span>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-semibold text-foreground">Estado del Servicio</h4>
                    </div>
                    <span
                      className={cn(
                        'px-3 py-1 rounded-full text-sm font-medium border',
                        selectedService.service_status === 'not_started' &&
                          'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20',
                        selectedService.service_status === 'in_progress' &&
                          'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
                        selectedService.service_status === 'completed' &&
                          'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
                        selectedService.service_status === 'on_hold' &&
                          'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                      )}
                    >
                      {selectedService.service_status === 'not_started' && 'No iniciado'}
                      {selectedService.service_status === 'in_progress' && 'En progreso'}
                      {selectedService.service_status === 'completed' && 'Completado'}
                      {selectedService.service_status === 'on_hold' && 'En espera'}
                      {selectedService.service_status === 'cancelled' && 'Cancelado'}
                    </span>
                  </div>
                </div>

                {/* Precio */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-2 border-purple-500/30 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-foreground mb-3">Precio del Servicio</h4>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                      {formatCurrency(selectedService.price_cop)}
                    </span>
                  </div>
                </div>

                {/* Fechas */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Creado:
                    </span>
                    <span className="font-medium text-foreground">
                      {formatDate(selectedService.created_at)}
                    </span>
                  </div>
                  {selectedService.paid_at && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Pagado:
                      </span>
                      <span className="font-medium text-foreground">
                        {formatDate(selectedService.paid_at)}
                      </span>
                    </div>
                  )}
                  {selectedService.updated_at && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Última actualización:
                      </span>
                      <span className="font-medium text-foreground">
                        {formatDate(selectedService.updated_at)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Adjuntos */}
                {selectedService.attachment_url && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Adjuntos
                    </h4>
                    <div className="flex items-center justify-between bg-background rounded-lg p-3 border">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {selectedService.attachment_url.split('-').pop()}
                          </p>
                          <p className="text-xs text-muted-foreground">Documento adjunto</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            const { data, error } = await supabase.storage
                              .from('service-orders')
                              .download(selectedService.attachment_url!)

                            if (error) throw error

                            const url = URL.createObjectURL(data)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = selectedService.attachment_url!.split('/').pop() || 'adjunto.pdf'
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                            URL.revokeObjectURL(url)
                          } catch (error: any) {
                            console.error('Error downloading file:', error)
                          }
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Descargar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Botón de pago si está pendiente */}
                {selectedService.payment_status === 'pending' && (
                  <div className="pt-4 border-t">
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => {
                        setSelectedService(null)
                        handlePayService(selectedService)
                      }}
                      disabled={payingService === selectedService.id}
                    >
                      {payingService === selectedService.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Procesando pago...
                        </>
                      ) : (
                        <>
                          <CircleDollarSign className="h-5 w-5 mr-2" />
                          Proceder al pago
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
