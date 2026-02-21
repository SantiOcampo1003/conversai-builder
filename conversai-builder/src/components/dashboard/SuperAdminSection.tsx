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
} from 'lucide-react'
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
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null)

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
        .select('id, name, email, company_name, created_at')
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

  console.log('🎯 FILTER - Search term:', searchTerm)
  console.log('🎯 FILTER - Filter status:', filterStatus)
  console.log('🎯 FILTER - Filtered orders count:', filteredOrders.length)
  console.log('🎯 FILTER - All orders:', orders.map(o => ({
    id: o.id,
    client: o.client?.name,
    service: o.service?.display_name,
    payment_status: o.payment_status,
    service_status: o.service_status
  })))

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
          Gestión de servicios profesionales para todos los clientes
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
                  filteredOrders.map((order) => (
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

      {/* Order Detail Sheet */}
      {selectedOrder && (
        <OrderDetailSheet
          order={selectedOrder}
          open={!!selectedOrder}
          onOpenChange={(open) => !open && setSelectedOrder(null)}
        />
      )}
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
