import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useClientContext } from '@/hooks/use-client-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import {
  createLine,
  deleteLine,
  listLines,
  logoutLine,
  reconnectLine,
  refreshLine,
  type LineStatus,
  type WhatsAppLine,
} from '@/lib/whatsapp-lines'
import { QRCodeSVG } from 'qrcode.react'
import {
  Plus,
  Trash2,
  RefreshCw,
  Smartphone,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────
interface Agent {
  agent_id: string
  business_name: string
}

// ── QR Code Component ──────────────────────────────────────────────────────
function QRCodeDisplay({ value, size = 160 }: { value: string; size?: number }) {
  // Si es una imagen base64, mostrarla directamente
  if (value?.startsWith('data:image')) {
    return <img src={value} alt="QR Code" style={{ width: size, height: size }} />
  }

  // Si no, generar el QR desde el texto
  try {
    return <QRCodeSVG value={value} size={size} level="L" />
  } catch (err) {
    console.error('Error rendering QR code:', err, 'Code length:', value?.length)
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-destructive mb-2">⚠️ Error: Código QR demasiado largo</p>
        <p className="text-[10px] text-muted-foreground mb-2">
          Usa el botón "Nuevo QR" o elimina esta línea y crea una nueva
        </p>
        <details className="text-left">
          <summary className="text-xs text-muted-foreground cursor-pointer">Ver código</summary>
          <code className="text-[10px] bg-muted p-2 rounded block mt-1 break-all max-h-20 overflow-y-auto">
            {value}
          </code>
        </details>
      </div>
    )
  }
}

// ── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: LineStatus }) {
  const config = {
    pending: {
      label: 'Pendiente',
      icon: Clock,
      className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    },
    connected: {
      label: 'Conectado',
      icon: CheckCircle2,
      className: 'bg-green-500/10 text-green-600 border-green-500/20',
    },
    disconnected: {
      label: 'Desconectado',
      icon: XCircle,
      className: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
    },
    error: {
      label: 'Error',
      icon: AlertCircle,
      className: 'bg-red-500/10 text-red-600 border-red-500/20',
    },
  }

  const { label, icon: Icon, className } = config[status]

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  )
}

// ── Add Line Dialog ────────────────────────────────────────────────────────
interface AddLineDialogProps {
  clientId: string
  onLineAdded: () => void
  canAddMore: boolean
}

function AddLineDialog({ clientId, onLineAdded, canAddMore }: AddLineDialogProps) {
  const [open, setOpen] = useState(false)
  const [lineName, setLineName] = useState('')
  const [loading, setLoading] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Polling encadenado: la siguiente consulta sale cuando terminó la anterior, sin acumular peticiones
  const pollRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; until: number }>({ timer: null, until: 0 })

  const stopPolling = () => {
    if (pollRef.current.timer) clearTimeout(pollRef.current.timer)
    pollRef.current = { timer: null, until: 0 }
  }

  useEffect(() => stopPolling, [])

  const handleCreate = async () => {
    if (!lineName.trim()) {
      setError('El nombre de la línea es requerido')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // El backend crea la instancia en Evolution y la fila en la base
      const line = await createLine(clientId, lineName.trim())
      setQrCode(line.qr_code)
      onLineAdded()

      if (line.qr_code) {
        startPolling(line.id)
      } else {
        setError('No se pudo generar el código QR. Intenta reconectar la línea.')
      }
    } catch (err) {
      setError((err as Error).message || 'Error al crear la línea')
    } finally {
      setLoading(false)
    }
  }

  // Evolution renueva el QR cada ~45 s: en cada vuelta se pinta el vigente hasta que conecte
  const startPolling = (lineId: string) => {
    stopPolling()
    // Tope de 3 minutos; la tarjeta de la línea sigue mostrando el QR después
    pollRef.current.until = Date.now() + 180000

    const tick = async () => {
      try {
        const line = await refreshLine(lineId)
        if (line.status === 'connected') {
          handleClose()
          onLineAdded()
          return
        }
        if (line.qr_code) setQrCode(line.qr_code)
      } catch (err) {
        console.error('Polling error:', err)
      }
      if (pollRef.current.until > Date.now()) pollRef.current.timer = setTimeout(tick, 5000)
    }
    pollRef.current.timer = setTimeout(tick, 5000)
  }

  const handleClose = () => {
    stopPolling()
    setOpen(false)
    setLineName('')
    setQrCode(null)
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button disabled={!canAddMore}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Línea
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar Línea de WhatsApp</DialogTitle>
          <DialogDescription>
            Conecta una nueva línea de WhatsApp para tus agentes.
          </DialogDescription>
        </DialogHeader>

        {!qrCode ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="line-name">Nombre de la línea</Label>
              <Input
                id="line-name"
                placeholder="Ej: Línea Principal, Soporte, Ventas..."
                value={lineName}
                onChange={(e) => setLineName(e.target.value)}
                disabled={loading}
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Smartphone className="h-4 w-4" />
                <span>Escanea el código QR desde WhatsApp</span>
              </div>

              {qrCode ? (
                <>
                  <div className="bg-white p-4 rounded-lg flex items-center justify-center">
                    <QRCodeDisplay value={qrCode} size={256} />
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>1. Abre WhatsApp en tu teléfono</p>
                    <p>2. Ve a Configuración → Dispositivos vinculados</p>
                    <p>3. Toca "Vincular un dispositivo"</p>
                    <p>4. Escanea este código QR</p>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Esperando conexión...</span>
                  </div>
                </>
              ) : (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  No se pudo obtener el código QR. Revisa la consola del navegador para más detalles.
                  <br />
                  <span className="text-xs">Puedes cerrar este diálogo y usar el botón "Reconectar" en la línea creada.</span>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {!qrCode ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={loading || !lineName.trim()}>
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Crear Línea'
                )}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleClose}>
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export function WAConnectionsSection() {
  const { user } = useAuth()
  const { clientId, isLoading: loadingClientId } = useClientContext()
  const [lines, setLines] = useState<WhatsAppLine[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [maxLines, setMaxLines] = useState(3)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const { toast } = useToast()

  // Cliente que se está mostrando: una respuesta de otro cliente (cambio de impersonalización) se descarta
  const shownClientRef = useRef(clientId)
  useEffect(() => {
    if (shownClientRef.current === clientId) return
    shownClientRef.current = clientId
    setLines([])
    setLoading(true)
  }, [clientId])

  const loadData = useCallback(async () => {
    if (!user || !clientId || loadingClientId) return
    const isStale = () => shownClientRef.current !== clientId

    // Sin setLoading(true): el skeleton es solo para la primera carga; recargar es silencioso
    try {
      // Obtener rol del usuario (o admin si es super_admin impersonalizando)
      const { data: membership } = await supabase
        .from('client_members')
        .select('role')
        .eq('auth_user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      if (isStale()) return
      setIsAdmin(membership?.role === 'super_admin' || membership?.role === 'admin')

      // Obtener límite de líneas usando clientId del hook
      const { data: clientData } = await supabase
        .from('clients')
        .select('max_whatsapp_lines')
        .eq('id', clientId)
        .single()

      if (isStale()) return
      if (clientData) {
        setMaxLines(clientData.max_whatsapp_lines)
      }

      // Líneas con el estado real de WhatsApp (el backend consulta Evolution)
      try {
        const { lines: synced, syncError: warning } = await listLines(clientId)
        if (isStale()) return
        setLines([...synced].reverse())
        setSyncError(warning)
      } catch (err) {
        // Si el backend no responde, mostrar lo guardado para no dejar el panel vacío
        const { data: linesData } = await supabase
          .from('whatsapp_lines')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
        if (isStale()) return
        setLines((linesData as WhatsAppLine[]) || [])
        setSyncError('No se pudo consultar el estado de WhatsApp; se muestra el último estado guardado.')
        console.error('Error syncing lines:', err)
      }

      // Obtener agentes usando clientId del hook
      const { data: agentsData } = await supabase
        .from('agents')
        .select('agent_id, business_name')
        .eq('client_id', clientId)
        .order('business_name')

      if (isStale()) return
      setAgents(agentsData || [])
      setLoading(false)
    } catch (err) {
      console.error('Error loading data:', err)
      if (!isStale()) setLoading(false)
    }
  }, [user, clientId, loadingClientId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const replaceLine = (updated: WhatsAppLine) =>
    setLines((prev) => prev.map((line) => (line.id === updated.id ? updated : line)))

  // Líneas esperando escaneo: cada 5 s (después de terminar la consulta anterior) se pide su estado
  // y el QR vigente, sin recargar la vista
  const pendingIds = lines.filter((line) => line.status === 'pending').map((line) => line.id).join(',')
  useEffect(() => {
    if (!pendingIds) return
    const ids = pendingIds.split(',')
    let timer: ReturnType<typeof setTimeout>
    let active = true
    const tick = async () => {
      await Promise.all(
        ids.map((id) =>
          refreshLine(id)
            .then((line) => active && setLines((prev) => prev.map((l) => (l.id === line.id ? line : l))))
            .catch((err) => console.error('Polling error:', err)),
        ),
      )
      if (active) timer = setTimeout(tick, 5000)
    }
    timer = setTimeout(tick, 5000)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [pendingIds])

  const showError = (title: string, err: unknown) =>
    toast({ title, description: (err as Error)?.message, variant: 'destructive' })

  const handleAssignAgent = async (lineId: string, agentId: string | null) => {
    try {
      const { error } = await supabase
        .from('whatsapp_lines')
        .update({ agent_id: agentId })
        .eq('id', lineId)

      if (error) throw error

      // Actualizar estado local
      setLines((prev) =>
        prev.map((line) =>
          line.id === lineId ? { ...line, agent_id: agentId } : line
        )
      )
    } catch (err) {
      console.error('Error assigning agent:', err)
    }
  }

  const handleDeleteLine = async (lineId: string) => {
    try {
      await deleteLine(lineId)
      setLines((prev) => prev.filter((line) => line.id !== lineId))
    } catch (err) {
      showError('No se pudo eliminar la línea', err)
    }
  }

  const handleLogout = async (lineId: string) => {
    try {
      replaceLine(await logoutLine(lineId))
    } catch (err) {
      showError('No se pudo desconectar la línea', err)
    }
  }

  const handleReconnect = async (lineId: string) => {
    try {
      replaceLine(await reconnectLine(lineId))
    } catch (err) {
      showError('No se pudo generar un QR nuevo', err)
    }
  }

  const handleVerify = async (lineId: string) => {
    try {
      replaceLine(await refreshLine(lineId))
    } catch (err) {
      showError('No se pudo consultar la línea', err)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Conexiones de WhatsApp</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gestiona las líneas de WhatsApp conectadas a tus agentes
            </p>
          </div>
          <div className="h-10 w-40 bg-secondary rounded-lg animate-pulse" />
        </div>

        {/* Usage Info Skeleton */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-40 bg-secondary rounded animate-pulse" />
              <div className="h-3 w-32 bg-secondary/50 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Lines Skeleton */}
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary animate-pulse" />
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-32 bg-secondary rounded animate-pulse" />
                    <div className="h-6 w-20 bg-secondary rounded-full animate-pulse" />
                  </div>
                  <div className="h-4 w-48 bg-secondary/50 rounded animate-pulse" />
                  <div className="flex gap-2">
                    <div className="h-8 w-24 bg-secondary rounded-lg animate-pulse" />
                    <div className="h-8 w-24 bg-secondary rounded-lg animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const canAddMore = lines.length < maxLines

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Conexiones de WhatsApp</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestiona las líneas de WhatsApp conectadas a tus agentes
          </p>
        </div>

        {isAdmin && clientId && (
          <AddLineDialog
            clientId={clientId}
            onLineAdded={loadData}
            canAddMore={canAddMore}
          />
        )}
      </div>

      {/* Usage info */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {lines.length} de {maxLines} líneas utilizadas
              </p>
              <p className="text-xs text-muted-foreground">
                {canAddMore
                  ? `Puedes agregar ${maxLines - lines.length} línea${maxLines - lines.length !== 1 ? 's' : ''} más`
                  : 'Has alcanzado el límite de líneas'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {syncError && (
        <div className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          {syncError}
        </div>
      )}

      {/* Lines list */}
      {lines.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-2xl p-16 flex flex-col items-center justify-center gap-4">
          <div className="bg-primary/10 rounded-full p-5 shadow-lg shadow-primary/20">
            <Smartphone className="h-10 w-10 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-foreground font-medium mb-1">No hay líneas conectadas</p>
            <p className="text-muted-foreground text-sm max-w-xs">
              Agrega tu primera línea de WhatsApp para comenzar a usar tus agentes.
            </p>
          </div>
          {isAdmin && clientId && (
            <AddLineDialog
              clientId={clientId}
              onLineAdded={loadData}
              canAddMore={canAddMore}
            />
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {lines.map((line) => {
            const assignedAgent = agents.find((a) => a.agent_id === line.agent_id)

            return (
              <div
                key={line.id}
                className="bg-card border border-border rounded-lg p-5 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-base font-semibold text-foreground truncate">
                        {line.line_name}
                      </h3>
                      <StatusBadge status={line.status} />
                    </div>

                    <div className="space-y-2 text-sm">
                      {line.phone_number && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Smartphone className="h-3.5 w-3.5" />
                          <span>{line.phone_number}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Agente:</span>
                        {isAdmin ? (
                          <Select
                            value={line.agent_id || 'none'}
                            onValueChange={(value) =>
                              handleAssignAgent(line.id, value === 'none' ? null : value)
                            }
                          >
                            <SelectTrigger className="w-[200px] h-8">
                              <SelectValue placeholder="Sin asignar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin asignar</SelectItem>
                              {agents.map((agent) => (
                                <SelectItem key={agent.agent_id} value={agent.agent_id}>
                                  {agent.business_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-foreground font-medium">
                            {assignedAgent?.business_name || 'Sin asignar'}
                          </span>
                        )}
                      </div>

                      {line.status === 'pending' && !line.qr_code && (
                        <div className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded p-2 mt-2">
                          ⏳ Generando código QR... Si no aparece, usa el botón "Reconectar"
                        </div>
                      )}

                      {line.error_message && (
                        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded p-2 mt-2">
                          {line.error_message}
                        </div>
                      )}

                      {line.status === 'pending' && line.qr_code && (
                        <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-muted-foreground">Escanea este código QR desde WhatsApp:</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReconnect(line.id)}
                              className="h-6 text-xs"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Nuevo QR
                            </Button>
                          </div>
                          <div className="bg-white p-2 rounded flex items-center justify-center">
                            <QRCodeDisplay value={line.qr_code} size={160} />
                          </div>
                          <div className="flex items-center justify-between text-xs mt-2">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              <span>Esperando conexión...</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleVerify(line.id)}
                              className="h-6 text-xs"
                              title="Verificar si ya está conectado"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Verificar
                            </Button>
                          </div>
                          <div className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded p-2 mt-2">
                            💡 El código se renueva solo cada ~45 segundos. Escanéalo apenas aparezca.
                          </div>
                        </div>
                      )}

                      {line.last_connected_at && (
                        <p className="text-xs text-muted-foreground">
                          Última conexión:{' '}
                          {new Date(line.last_connected_at).toLocaleString('es-ES')}
                        </p>
                      )}
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      {line.status === 'connected' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1.5" />
                              Desconectar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Desconectar WhatsApp?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esto cerrará la sesión de WhatsApp en "{line.line_name}". Podrás reconectar más tarde escaneando un nuevo código QR.
                                <br /><br />
                                La configuración y asignación al agente se mantendrán.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleLogout(line.id)}
                                className="bg-orange-600 text-white hover:bg-orange-700"
                              >
                                Desconectar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}

                      {(line.status === 'disconnected' || line.status === 'error') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReconnect(line.id)}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                          Reconectar
                        </Button>
                      )}

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar línea?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se eliminará "{line.line_name}" y se desconectará de WhatsApp. Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteLine(line.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
