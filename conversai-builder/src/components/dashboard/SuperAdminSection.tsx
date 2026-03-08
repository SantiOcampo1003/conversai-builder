import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Building2,
  Plus,
  DollarSign,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Users,
  Package,
  Search,
  FileText,
  Eye,
  Calendar,
  MessageCircle,
  CheckSquare,
  ArrowRight,
  Gift,
  Zap,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  LogIn,
  Upload,
  Download,
  Trash2,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

// ── Types ──────────────────────────────────────────────────────────────────
type Service = {
  id: string
  name: string
  display_name: string
  description: string
  price_cop: number
  price_usd: number
  service_type: string
  active: boolean
}

type Client = {
  id: string
  name: string
  email: string
  company_name: string
  phone: string | null
  created_at: string
}

type ServiceOrder = {
  id: string
  service_id: string
  client_id: string
  assigned_to: string | null
  custom_description: string | null
  price_cop: number
  price_usd: number | null
  payment_status: 'pending' | 'paid' | 'cancelled' | 'refunded'
  service_status: 'not_started' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold'
  estimated_completion_date: string | null
  attachment_url: string | null
  created_at: string
  updated_at: string
  // Joins
  service?: Service
  client?: Client
}

// ── Payment Status Badge ───────────────────────────────────────────────────
function PaymentStatusBadge({ status }: { status: ServiceOrder['payment_status'] }) {
  const config = {
    pending: { label: 'Pendiente', variant: 'outline' as const, icon: Clock, className: 'border-amber-500 text-amber-700 dark:text-amber-400' },
    paid: { label: 'Pagado', variant: 'default' as const, icon: CheckCircle2, className: 'bg-green-500 hover:bg-green-600' },
    cancelled: { label: 'Cancelado', variant: 'destructive' as const, icon: XCircle, className: '' },
    refunded: { label: 'Reembolsado', variant: 'secondary' as const, icon: DollarSign, className: '' },
  }
  const cfg = config[status]
  const Icon = cfg.icon
  return (
    <Badge variant={cfg.variant} className={cn('gap-1', cfg.className)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  )
}

// ── Service Status Badge ───────────────────────────────────────────────────
function ServiceStatusBadge({ status }: { status: ServiceOrder['service_status'] }) {
  const config = {
    not_started: { label: 'No iniciado', variant: 'outline' as const, className: 'border-gray-400 text-gray-600 dark:text-gray-400' },
    in_progress: { label: 'En progreso', variant: 'default' as const, className: 'bg-blue-500 hover:bg-blue-600' },
    completed: { label: 'Completado', variant: 'default' as const, className: 'bg-green-500 hover:bg-green-600' },
    cancelled: { label: 'Cancelado', variant: 'destructive' as const, className: '' },
    on_hold: { label: 'En espera', variant: 'secondary' as const, className: 'bg-amber-500 hover:bg-amber-600' },
  }
  const cfg = config[status]
  return (
    <Badge variant={cfg.variant} className={cfg.className}>
      {cfg.label}
    </Badge>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export function SuperAdminSection() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Estados para órdenes de servicio
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null)
  const [ordersPage, setOrdersPage] = useState(1)
  const ordersPerPage = 10

  // Estados para gestión de clientes
  const [clientSearchTerm, setClientSearchTerm] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientsPage, setClientsPage] = useState(1)
  const [giftTokensDialogOpen, setGiftTokensDialogOpen] = useState(false)
  const [createClientDialogOpen, setCreateClientDialogOpen] = useState(false)
  const clientsPerPage = 10

  // ── Obtener el client_id del super admin actual ───────────────────────────
  const { data: myClientId } = useQuery({
    queryKey: ['my-client-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data: membership } = await supabase
        .from('client_members')
        .select('client_id')
        .eq('auth_user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      return membership?.client_id || null
    },
    staleTime: Infinity, // No cambia durante la sesión
  })

  // ── Fetch Services ───────────────────────────────────────────────────────
  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error
      return data as Service[]
    },
    staleTime: 1000, // Considera datos obsoletos después de 1 segundo
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  // ── Fetch Clients ────────────────────────────────────────────────────────
  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, email, company_name, phone, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Client[]
    },
    staleTime: 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  // ── Fetch Service Orders ─────────────────────────────────────────────────
  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['service-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_orders')
        .select(`
          *,
          service:services(*),
          client:clients(id, name, email, company_name)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Error fetching service orders:', error)
        throw error
      }

      console.log('🔍 SUPER ADMIN - Service Orders:', data)
      console.log('🔍 SUPER ADMIN - Orders Count:', data?.length || 0)

      return data as ServiceOrder[]
    },
    staleTime: 1000, // Considera datos obsoletos después de 1 segundo
    refetchOnMount: true, // Refetch cuando el componente se monta
    refetchOnWindowFocus: true, // Refetch cuando vuelves a la ventana
    refetchInterval: 30000, // Refetch automático cada 30 segundos
  })

  // ── Filter Orders ────────────────────────────────────────────────────────
  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.client?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.client?.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.service?.display_name.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'payment_pending' && order.payment_status === 'pending') ||
      (filterStatus === 'payment_paid' && order.payment_status === 'paid') ||
      (filterStatus === 'service_active' && ['not_started', 'in_progress', 'on_hold'].includes(order.service_status)) ||
      (filterStatus === 'service_completed' && order.service_status === 'completed')

    return matchesSearch && matchesStatus
  })

  // Paginación de órdenes
  const totalOrdersPages = Math.ceil(filteredOrders.length / ordersPerPage)
  const paginatedOrders = filteredOrders.slice(
    (ordersPage - 1) * ordersPerPage,
    ordersPage * ordersPerPage
  )

  // ── Filter Clients ───────────────────────────────────────────────────────
  const filteredClients = clients.filter(client => {
    const matchesSearch =
      client.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
      client.company_name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(clientSearchTerm.toLowerCase())

    return matchesSearch
  })

  // Paginación de clientes
  const totalClientsPages = Math.ceil(filteredClients.length / clientsPerPage)
  const paginatedClients = filteredClients.slice(
    (clientsPage - 1) * clientsPerPage,
    clientsPage * clientsPerPage
  )

  // ── Create Order Mutation ────────────────────────────────────────────────
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: {
      service_id: string
      client_id: string
      custom_description?: string
      price_cop: number
      price_usd?: number
    }) => {
      const { data, error } = await supabase
        .from('service_orders')
        .insert([orderData])
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      // Invalidar queries para refrescar los datos
      queryClient.invalidateQueries({ queryKey: ['service-orders'] })
      queryClient.invalidateQueries({ queryKey: ['tokens-data'] }) // Para que el cliente también vea la orden
      toast({
        title: 'Orden creada',
        description: 'La orden de servicio ha sido creada exitosamente',
      })
      setCreateDialogOpen(false)
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al crear orden',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // ── Gift Tokens Mutation ─────────────────────────────────────────────────
  const giftTokensMutation = useMutation({
    mutationFn: async ({ clientId, tokens, description }: { clientId: string; tokens: number; description: string }) => {
      // Crear transacción de bonus (con columnas nuevas de tracking)
      const { data: transaction, error: txError } = await supabase
        .from('token_transactions')
        .insert([{
          client_id: clientId,
          type: 'bonus',
          tokens: tokens,
          tokens_real: tokens, // Tokens regalados = tokens reales
          tokens_charged: tokens, // Tokens cobrados = tokens reales (sin markup en regalos)
          markup_percentage: 0, // No hay markup en tokens regalados
          description: description || 'Tokens de regalo del Super Admin',
          payment_status: 'completed',
        }])
        .select()
        .single()

      if (txError) throw txError

      // Actualizar balance del cliente
      const { error: balanceError } = await supabase.rpc('update_token_balance', {
        p_client_id: clientId,
        p_tokens: tokens,
      })

      if (balanceError) throw balanceError

      return transaction
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tokens-data'] })
      toast({
        title: 'Tokens regalados',
        description: 'Los tokens han sido agregados exitosamente al cliente',
      })
      setGiftTokensDialogOpen(false)
      setSelectedClient(null)
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al regalar tokens',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // ── Create Client Mutation ───────────────────────────────────────────────
  const createClientMutation = useMutation({
    mutationFn: async (clientData: {
      name: string
      email: string
      company_name?: string
      phone?: string
    }) => {
      // Crear cliente
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert([clientData])
        .select()
        .single()

      if (clientError) throw clientError

      // Crear balance de tokens inicial (opcional: 0 tokens)
      // NOTA: available_tokens es una columna generada, no se debe insertar
      const { error: balanceError } = await supabase
        .from('token_balances')
        .insert([{
          client_id: client.id,
          total_tokens: 0,
          used_tokens: 0,
          is_active: true,
        }])

      if (balanceError) console.warn('Warning creating token balance:', balanceError)

      return client
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast({
        title: 'Cliente creado',
        description: 'El cliente ha sido creado exitosamente',
      })
      setCreateClientDialogOpen(false)
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al crear cliente',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // ── Impersonation Function ───────────────────────────────────────────────
  const handleImpersonate = async (clientId: string) => {
    try {
      // Guardar sesión actual en sessionStorage
      const currentUser = await supabase.auth.getUser()
      if (!currentUser.data.user) {
        throw new Error('No hay sesión activa')
      }

      sessionStorage.setItem('super_admin_impersonating', JSON.stringify({
        originalUserId: currentUser.data.user.id,
        targetClientId: clientId,
        timestamp: new Date().toISOString(),
      }))

      // Disparar evento para que otros componentes se enteren
      window.dispatchEvent(new Event('impersonation-changed'))

      // Redirigir al dashboard del cliente (simulando que es su cuenta)
      window.location.href = `/dashboard/overview?impersonate=${clientId}`
    } catch (error: any) {
      toast({
        title: 'Error al acceder',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  // ── Loading State ────────────────────────────────────────────────────────
  if (loadingServices || loadingClients || loadingOrders) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Panel Super Admin</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestión de servicios profesionales y clientes
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Órdenes Activas</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orders.filter(o => ['not_started', 'in_progress', 'on_hold'].includes(o.service_status)).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orders.filter(o => o.payment_status === 'pending').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Servicios Disponibles</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{services.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs para Órdenes y Clientes */}
      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="orders">
            <Package className="h-4 w-4 mr-2" />
            Órdenes de Servicio
          </TabsTrigger>
          <TabsTrigger value="clients">
            <Users className="h-4 w-4 mr-2" />
            Gestión de Clientes
          </TabsTrigger>
        </TabsList>

        {/* Tab: Órdenes de Servicio */}
        <TabsContent value="orders" className="space-y-4 mt-6">
          {/* Actions Bar */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2 w-full sm:w-auto flex-1">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente o servicio..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="payment_pending">Pago pendiente</SelectItem>
              <SelectItem value="payment_paid">Pagado</SelectItem>
              <SelectItem value="service_active">Servicio activo</SelectItem>
              <SelectItem value="service_completed">Completado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <CreateOrderDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          services={services}
          clients={clients}
          onSubmit={createOrderMutation.mutate}
          isLoading={createOrderMutation.isPending}
        />
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Órdenes de Servicio</CardTitle>
          <CardDescription>
            {filteredOrders.length} {filteredOrders.length === 1 ? 'orden' : 'órdenes'} {searchTerm || filterStatus !== 'all' ? 'encontradas' : 'totales'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No se encontraron órdenes
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{order.client?.name}</span>
                          <span className="text-xs text-muted-foreground">{order.client?.company_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{order.service?.display_name}</span>
                          {order.custom_description && (
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {order.custom_description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            ${new Intl.NumberFormat('es-CO').format(order.price_cop)} COP
                          </span>
                          {order.price_usd && (
                            <span className="text-xs text-muted-foreground">
                              ${order.price_usd} USD
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={order.payment_status} />
                      </TableCell>
                      <TableCell>
                        <ServiceStatusBadge status={order.service_status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver detalles
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Orders Pagination */}
      {totalOrdersPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {((ordersPage - 1) * ordersPerPage) + 1} a {Math.min(ordersPage * ordersPerPage, filteredOrders.length)} de {filteredOrders.length} órdenes
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOrdersPage(p => Math.max(1, p - 1))}
              disabled={ordersPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-sm font-medium">
              Página {ordersPage} de {totalOrdersPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOrdersPage(p => Math.min(totalOrdersPages, p + 1))}
              disabled={ordersPage === totalOrdersPages}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </TabsContent>

        {/* Tab: Gestión de Clientes */}
        <TabsContent value="clients" className="space-y-4 mt-6">
          {/* Search Bar and Create Button */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                className="pl-8"
                value={clientSearchTerm}
                onChange={(e) => {
                  setClientSearchTerm(e.target.value)
                  setClientsPage(1) // Reset to page 1 on search
                }}
              />
            </div>
            <Button onClick={() => setCreateClientDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Crear Cliente
            </Button>
          </div>

          {/* Clients Table */}
          <Card>
            <CardHeader>
              <CardTitle>Clientes</CardTitle>
              <CardDescription>
                {filteredClients.length} {filteredClients.length === 1 ? 'cliente' : 'clientes'} {clientSearchTerm ? 'encontrados' : 'totales'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Fecha de Registro</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedClients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No se encontraron clientes
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedClients.map((client) => (
                        <TableRow key={client.id}>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{client.name}</span>
                                {client.id === myClientId && (
                                  <Badge variant="secondary" className="text-xs">
                                    Tu cuenta
                                  </Badge>
                                )}
                              </div>
                              {client.company_name && (
                                <span className="text-xs text-muted-foreground">{client.company_name}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{client.email}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{client.phone || '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(client.created_at).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedClient(client)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver detalles
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Clients Pagination */}
          {totalClientsPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {((clientsPage - 1) * clientsPerPage) + 1} a {Math.min(clientsPage * clientsPerPage, filteredClients.length)} de {filteredClients.length} clientes
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setClientsPage(p => Math.max(1, p - 1))}
                  disabled={clientsPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <span className="text-sm font-medium">
                  Página {clientsPage} de {totalClientsPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setClientsPage(p => Math.min(totalClientsPages, p + 1))}
                  disabled={clientsPage === totalClientsPages}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Order Detail Sheet */}
      {selectedOrder && (
        <OrderDetailSheet
          order={selectedOrder}
          open={!!selectedOrder}
          onOpenChange={(open) => !open && setSelectedOrder(null)}
        />
      )}

      {/* Client Detail Sheet */}
      {selectedClient && (
        <ClientDetailSheet
          client={selectedClient}
          open={!!selectedClient}
          onOpenChange={(open) => {
            if (!open) setSelectedClient(null)
          }}
          onGiftTokens={() => setGiftTokensDialogOpen(true)}
          onImpersonate={() => handleImpersonate(selectedClient.id)}
          myClientId={myClientId}
        />
      )}

      {/* Gift Tokens Dialog */}
      {selectedClient && (
        <GiftTokensDialog
          open={giftTokensDialogOpen}
          onOpenChange={setGiftTokensDialogOpen}
          client={selectedClient}
          onSubmit={giftTokensMutation.mutate}
          isLoading={giftTokensMutation.isPending}
        />
      )}

      {/* Create Client Dialog */}
      <CreateClientDialog
        open={createClientDialogOpen}
        onOpenChange={setCreateClientDialogOpen}
        onSubmit={createClientMutation.mutate}
        isLoading={createClientMutation.isPending}
      />
    </div>
  )
}

// ── Create Order Dialog ────────────────────────────────────────────────────
function CreateOrderDialog({
  open,
  onOpenChange,
  services,
  clients,
  onSubmit,
  isLoading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  services: Service[]
  clients: Client[]
  onSubmit: (data: any) => void
  isLoading: boolean
}) {
  const [selectedService, setSelectedService] = useState<string>('')
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [customDescription, setCustomDescription] = useState('')
  const [customPrice, setCustomPrice] = useState('')

  const service = services.find(s => s.id === selectedService)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedService || !selectedClient) return

    const finalPrice = customPrice ? parseInt(customPrice) : (service?.price_cop || 0)

    onSubmit({
      service_id: selectedService,
      client_id: selectedClient,
      custom_description: customDescription || undefined,
      price_cop: finalPrice,
      price_usd: service?.price_usd,
    })

    // Reset form
    setSelectedService('')
    setSelectedClient('')
    setCustomDescription('')
    setCustomPrice('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Crear Orden de Servicio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nueva Orden de Servicio</DialogTitle>
            <DialogDescription>
              Crea una orden de servicio profesional para un cliente
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="client">Cliente *</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient} required>
                <SelectTrigger id="client">
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex flex-col">
                        <span>{client.name}</span>
                        <span className="text-xs text-muted-foreground">{client.company_name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="service">Servicio *</Label>
              <Select value={selectedService} onValueChange={setSelectedService} required>
                <SelectTrigger id="service">
                  <SelectValue placeholder="Selecciona un servicio" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      <div className="flex flex-col">
                        <span>{service.display_name}</span>
                        <span className="text-xs text-muted-foreground">
                          ${new Intl.NumberFormat('es-CO').format(service.price_cop)} COP
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {service && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">{service.description}</p>
                <p className="text-sm font-medium">
                  Precio base: ${new Intl.NumberFormat('es-CO').format(service.price_cop)} COP
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="custom_description">Descripción personalizada (opcional)</Label>
              <Textarea
                id="custom_description"
                placeholder="Agrega detalles específicos de este servicio..."
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="custom_price">Precio personalizado (opcional)</Label>
              <Input
                id="custom_price"
                type="number"
                placeholder={service ? `${service.price_cop}` : 'Precio en COP'}
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Deja vacío para usar el precio del servicio
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!selectedService || !selectedClient || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Orden'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Order Detail Sheet ─────────────────────────────────────────────────────
function OrderDetailSheet({
  order,
  open,
  onOpenChange,
}: {
  order: ServiceOrder
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [newComment, setNewComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [uploading, setUploading] = useState(false)

  // ── Fetch Comments ─────────────────────────────────────────────────────
  const { data: comments = [] } = useQuery({
    queryKey: ['service-comments', order.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_comments')
        .select(`
          *,
          author:auth.users(email, raw_user_metadata)
        `)
        .eq('service_order_id', order.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as any[]
    },
    enabled: open,
  })

  // ── Fetch Deliverables ─────────────────────────────────────────────────
  const { data: deliverables = [] } = useQuery({
    queryKey: ['service-deliverables', order.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_deliverables')
        .select('*')
        .eq('service_order_id', order.id)
        .order('sort_order', { ascending: true })

      if (error) throw error
      return data as any[]
    },
    enabled: open,
  })

  // ── Update Payment Status ──────────────────────────────────────────────
  const updatePaymentStatus = useMutation({
    mutationFn: async (status: ServiceOrder['payment_status']) => {
      const { error } = await supabase
        .from('service_orders')
        .update({
          payment_status: status,
          paid_at: status === 'paid' ? new Date().toISOString() : null,
        })
        .eq('id', order.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-orders'] })
      toast({ title: 'Estado de pago actualizado' })
    },
  })

  // ── Update Service Status ──────────────────────────────────────────────
  const updateServiceStatus = useMutation({
    mutationFn: async (status: ServiceOrder['service_status']) => {
      const { error } = await supabase
        .from('service_orders')
        .update({
          service_status: status,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
        })
        .eq('id', order.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-orders'] })
      toast({ title: 'Estado de servicio actualizado' })
    },
  })

  // ── Add Comment ────────────────────────────────────────────────────────
  const addComment = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { error } = await supabase.from('service_comments').insert({
        service_order_id: order.id,
        author_id: user.id,
        author_type: 'admin',
        comment: newComment,
        is_internal: isInternal,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-comments', order.id] })
      setNewComment('')
      setIsInternal(false)
      toast({ title: 'Comentario agregado' })
    },
  })

  // ── Upload Attachment ──────────────────────────────────────────────────
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validar tamaño (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Archivo muy grande',
        description: 'El archivo no puede superar los 10MB',
        variant: 'destructive',
      })
      return
    }

    setUploading(true)

    try {
      // Eliminar archivo anterior si existe
      if (order.attachment_url) {
        await supabase.storage.from('service-orders').remove([order.attachment_url])
      }

      // Subir nuevo archivo
      const fileExt = file.name.split('.').pop()
      const fileName = `${order.id}-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('service-orders')
        .upload(filePath, file, {
          upsert: true,
        })

      if (uploadError) throw uploadError

      // Actualizar order con la URL del archivo
      const { error: updateError } = await supabase
        .from('service_orders')
        .update({ attachment_url: filePath })
        .eq('id', order.id)

      if (updateError) throw updateError

      queryClient.invalidateQueries({ queryKey: ['service-orders'] })
      toast({ title: 'Archivo subido correctamente' })
    } catch (error: any) {
      console.error('Error uploading file:', error)
      toast({
        title: 'Error al subir archivo',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      event.target.value = '' // Reset input
    }
  }

  // ── Download Attachment ────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!order.attachment_url) return

    try {
      const { data, error } = await supabase.storage
        .from('service-orders')
        .download(order.attachment_url)

      if (error) throw error

      // Crear URL para descargar
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = order.attachment_url.split('/').pop() || 'adjunto.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error: any) {
      console.error('Error downloading file:', error)
      toast({
        title: 'Error al descargar archivo',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  // ── Delete Attachment ──────────────────────────────────────────────────
  const handleDeleteAttachment = async () => {
    if (!order.attachment_url) return

    try {
      // Eliminar de storage
      const { error: storageError } = await supabase.storage
        .from('service-orders')
        .remove([order.attachment_url])

      if (storageError) throw storageError

      // Actualizar order
      const { error: updateError } = await supabase
        .from('service_orders')
        .update({ attachment_url: null })
        .eq('id', order.id)

      if (updateError) throw updateError

      queryClient.invalidateQueries({ queryKey: ['service-orders'] })
      toast({ title: 'Archivo eliminado' })
    } catch (error: any) {
      console.error('Error deleting file:', error)
      toast({
        title: 'Error al eliminar archivo',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalle de Orden de Servicio</SheetTitle>
          <SheetDescription>
            Orden #{order.id.slice(0, 8)}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] pr-4">
          <div className="space-y-6 py-6">
            {/* Cliente Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Nombre</Label>
                  <p className="font-medium">{order.client?.name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Empresa</Label>
                  <p>{order.client?.company_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <p className="text-sm">{order.client?.email}</p>
                </div>
              </CardContent>
            </Card>

            {/* Servicio Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Servicio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Servicio</Label>
                  <p className="font-medium">{order.service?.display_name}</p>
                </div>
                {order.custom_description && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Descripción personalizada</Label>
                    <p className="text-sm">{order.custom_description}</p>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">Precio</Label>
                  <p className="font-medium">
                    ${new Intl.NumberFormat('es-CO').format(order.price_cop)} COP
                    {order.price_usd && ` / $${order.price_usd} USD`}
                  </p>
                </div>
                {order.estimated_completion_date && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Fecha estimada de entrega</Label>
                    <p className="text-sm flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(order.estimated_completion_date).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Estados */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Payment Status */}
                <div>
                  <Label className="text-xs text-muted-foreground">Estado de Pago</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <PaymentStatusBadge status={order.payment_status} />
                    <Select
                      value={order.payment_status}
                      onValueChange={(value) => updatePaymentStatus.mutate(value as any)}
                      disabled={updatePaymentStatus.isPending}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendiente</SelectItem>
                        <SelectItem value="paid">Pagado</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                        <SelectItem value="refunded">Reembolsado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Service Status */}
                <div>
                  <Label className="text-xs text-muted-foreground">Estado del Servicio</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <ServiceStatusBadge status={order.service_status} />
                    <Select
                      value={order.service_status}
                      onValueChange={(value) => updateServiceStatus.mutate(value as any)}
                      disabled={updateServiceStatus.isPending}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">No iniciado</SelectItem>
                        <SelectItem value="in_progress">En progreso</SelectItem>
                        <SelectItem value="on_hold">En espera</SelectItem>
                        <SelectItem value="completed">Completado</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Adjuntos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Adjuntos
                </CardTitle>
                <CardDescription>
                  Sube cotizaciones, contratos o documentos relacionados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.attachment_url ? (
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-secondary/20">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">
                          {order.attachment_url.split('-').pop()}
                        </p>
                        <p className="text-xs text-muted-foreground">Adjunto actual</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDownload}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Descargar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDeleteAttachment}
                        className="gap-2 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-4 border-2 border-dashed rounded-lg">
                    <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-3">No hay adjuntos</p>
                  </div>
                )}

                <div>
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={uploading}
                        className="gap-2"
                        onClick={() => document.getElementById('file-upload')?.click()}
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Subiendo...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4" />
                            {order.attachment_url ? 'Reemplazar archivo' : 'Subir archivo'}
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        PDF, Word, Imágenes (máx. 10MB)
                      </p>
                    </div>
                  </Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Deliverables */}
            {deliverables.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    Entregables ({deliverables.filter((d: any) => d.status === 'completed').length}/{deliverables.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {deliverables.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 p-2 rounded-lg border"
                      >
                        {item.status === 'completed' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{item.title}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          )}
                        </div>
                        <Badge
                          variant={item.status === 'completed' ? 'default' : 'outline'}
                          className="shrink-0"
                        >
                          {item.status === 'completed' ? 'Completado' : 'Pendiente'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comentarios */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Comentarios ({comments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Lista de comentarios */}
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay comentarios aún
                    </p>
                  ) : (
                    comments.map((comment: any) => (
                      <div
                        key={comment.id}
                        className={cn(
                          'p-3 rounded-lg border',
                          comment.is_internal && 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {comment.author?.raw_user_metadata?.name || comment.author?.email || 'Usuario'}
                            </span>
                            {comment.is_internal && (
                              <Badge variant="outline" className="text-xs">
                                Interno
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(comment.created_at).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-sm">{comment.comment}</p>
                      </div>
                    ))
                  )}
                </div>

                <Separator />

                {/* Nuevo comentario */}
                <div className="space-y-2">
                  <Label>Nuevo comentario</Label>
                  <Textarea
                    placeholder="Escribe un comentario..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="internal"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="internal" className="text-sm cursor-pointer">
                        Comentario interno (solo visible para admins)
                      </Label>
                    </div>
                    <Button
                      onClick={() => addComment.mutate()}
                      disabled={!newComment.trim() || addComment.isPending}
                      size="sm"
                    >
                      {addComment.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Enviar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Información adicional</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Creada:</span>
                  <span>
                    {new Date(order.created_at).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Última actualización:</span>
                  <span>
                    {new Date(order.updated_at).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {order.completed_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completada:</span>
                    <span>
                      {new Date(order.completed_at).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// ── Client Detail Sheet ────────────────────────────────────────────────────
function ClientDetailSheet({
  client,
  open,
  onOpenChange,
  onGiftTokens,
  onImpersonate,
  myClientId,
}: {
  client: Client
  open: boolean
  onOpenChange: (open: boolean) => void
  onGiftTokens: () => void
  onImpersonate: () => void
  myClientId?: string | null
}) {
  const { data: clientData, isLoading } = useQuery({
    queryKey: ['client-detail', client.id],
    queryFn: async () => {
      // Obtener balance de tokens
      const { data: balance } = await supabase
        .from('token_balances')
        .select('total_tokens, used_tokens, available_tokens')
        .eq('client_id', client.id)
        .maybeSingle()

      // Obtener órdenes de servicio
      const { data: orders } = await supabase
        .from('service_orders')
        .select(`
          *,
          service:services(display_name)
        `)
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(5)

      // Obtener miembros del equipo
      const { data: members } = await supabase
        .from('client_members')
        .select(`
          id,
          role,
          status,
          created_at,
          auth_user_id
        `)
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })

      return {
        balance: balance || null,
        orders: orders || [],
        members: members || [],
      }
    },
    enabled: open,
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {client.company_name || client.name}
          </SheetTitle>
          <SheetDescription>
            Información detallada del cliente
          </SheetDescription>
        </SheetHeader>

        {/* Impersonate Button */}
        <div className="mt-4">
          {client.id === myClientId ? (
            <>
              <Button
                disabled
                variant="outline"
                className="w-full gap-2 border-muted bg-muted/50 cursor-not-allowed"
              >
                <Building2 className="h-4 w-4" />
                Esta es tu cuenta
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Ya estás autenticado con esta cuenta
              </p>
            </>
          ) : (
            <>
              <Button
                onClick={onImpersonate}
                variant="outline"
                className="w-full gap-2 border-primary/50 hover:bg-primary/10"
              >
                <LogIn className="h-4 w-4" />
                Acceder como Cliente
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Accede al dashboard del cliente para configurar su cuenta
              </p>
            </>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 mt-6">
            {/* Información del Cliente */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Información General</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className="text-sm text-muted-foreground">Nombre:</span>
                  <span className="text-sm font-medium text-right">{client.name}</span>
                </div>
                {client.company_name && (
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-muted-foreground">Empresa:</span>
                    <span className="text-sm font-medium text-right">{client.company_name}</span>
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Email:
                  </span>
                  <span className="text-sm font-medium text-right">{client.email}</span>
                </div>
                {client.phone && (
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      Teléfono:
                    </span>
                    <span className="text-sm font-medium text-right">{client.phone}</span>
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Registro:
                  </span>
                  <span className="text-sm font-medium text-right">
                    {new Date(client.created_at).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Balance de Tokens */}
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Balance de Tokens
                  </span>
                  <Button
                    size="sm"
                    onClick={onGiftTokens}
                    className="gap-2"
                  >
                    <Gift className="h-4 w-4" />
                    Regalar Tokens
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {clientData?.balance ? (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Totales</p>
                      <p className="text-2xl font-bold text-foreground">
                        {clientData.balance.total_tokens.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Usados</p>
                      <p className="text-2xl font-bold text-red-600">
                        {clientData.balance.used_tokens.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Disponibles</p>
                      <p className="text-2xl font-bold text-primary">
                        {clientData.balance.available_tokens.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Sin balance configurado
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Órdenes Recientes */}
            {clientData?.orders && clientData.orders.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Órdenes Recientes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {clientData.orders.map((order: any) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-2 rounded-lg border bg-muted/30"
                    >
                      <div>
                        <p className="text-sm font-medium">{order.service?.display_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <PaymentStatusBadge status={order.payment_status} />
                        <ServiceStatusBadge status={order.service_status} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Miembros del Equipo */}
            {clientData?.members && clientData.members.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Miembros del Equipo ({clientData.members.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {clientData.members.map((member: any) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2 rounded-lg border bg-muted/30"
                    >
                      <div>
                        <p className="text-sm font-medium capitalize">{member.role.replace('_', ' ')}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(member.created_at).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                      <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                        {member.status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── Gift Tokens Dialog ─────────────────────────────────────────────────────
function GiftTokensDialog({
  open,
  onOpenChange,
  client,
  onSubmit,
  isLoading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: Client
  onSubmit: (data: { clientId: string; tokens: number; description: string }) => void
  isLoading: boolean
}) {
  const [tokens, setTokens] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const tokensNum = parseInt(tokens)
    if (isNaN(tokensNum) || tokensNum <= 0) {
      return
    }
    onSubmit({
      clientId: client.id,
      tokens: tokensNum,
      description: description || `Tokens de regalo del Super Admin`,
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTokens('')
      setDescription('')
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Regalar Tokens
          </DialogTitle>
          <DialogDescription>
            Agregar tokens de regalo a {client.company_name || client.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="tokens">Cantidad de Tokens</Label>
            <Input
              id="tokens"
              type="number"
              min="1"
              placeholder="Ej: 1000"
              value={tokens}
              onChange={(e) => setTokens(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Los tokens se agregarán inmediatamente al balance del cliente
            </p>
          </div>

          <div>
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Ej: Tokens de cortesía por..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !tokens}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Gift className="h-4 w-4 mr-2" />
                  Regalar Tokens
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Create Client Dialog ───────────────────────────────────────────────────
function CreateClientDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { name: string; email: string; company_name?: string; phone?: string }) => void
  isLoading: boolean
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email) return

    onSubmit({
      name,
      email,
      company_name: companyName || undefined,
      phone: phone || undefined,
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName('')
      setEmail('')
      setCompanyName('')
      setPhone('')
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Crear Nuevo Cliente
          </DialogTitle>
          <DialogDescription>
            Ingresa la información básica del nuevo cliente
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre Completo *</Label>
            <Input
              id="name"
              placeholder="Ej: Juan Pérez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="Ej: juan@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="company">Nombre de la Empresa (opcional)</Label>
            <Input
              id="company"
              placeholder="Ej: Mi Empresa S.A.S."
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="phone">Teléfono (opcional)</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="Ej: +57 300 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !name || !email}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Crear Cliente
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
