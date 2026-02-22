import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useClientContext } from '@/hooks/use-client-context'
import { supabase } from '@/lib/supabase'
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
type LineStatus = 'pending' | 'connected' | 'disconnected' | 'error'

interface WhatsAppLine {
  id: string
  client_id: string
  line_name: string
  phone_number: string | null
  agent_id: string | null
  status: LineStatus
  evolution_instance_name: string
  qr_code: string | null
  last_connected_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

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
  const [newLineId, setNewLineId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!lineName.trim()) {
      setError('El nombre de la línea es requerido')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 1. Crear instancia en Evolution API
      const evolutionUrl = import.meta.env.VITE_EVOLUTION_API_URL
      const evolutionKey = import.meta.env.VITE_EVOLUTION_API_KEY

      console.log('Evolution API URL:', evolutionUrl)
      console.log('Evolution API Key exists:', !!evolutionKey)

      if (!evolutionUrl || !evolutionKey) {
        const errMsg = 'Evolution API no está configurada. Verifica las variables de entorno VITE_EVOLUTION_API_URL y VITE_EVOLUTION_API_KEY'
        console.error(errMsg)
        throw new Error(errMsg)
      }

      // Generar nombre de instancia único
      const instanceName = `line_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      console.log('Creating instance:', instanceName)

      const webhookUrl = import.meta.env.VITE_EVOLUTION_WEBHOOK_URL

      const requestBody = {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        ...(webhookUrl && {
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            base64: true,
            events: ['MESSAGES_UPSERT'],
          }
        })
      }
      console.log('Request body:', requestBody)

      const response = await fetch(`${evolutionUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionKey,
        },
        body: JSON.stringify(requestBody),
      })

      console.log('Response status:', response.status, response.statusText)

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data?.response?.message?.[0] || data?.message || 'Error al crear instancia en Evolution API'
        throw new Error(errorMsg)
      }

      console.log('Evolution API response:', data)

      // Extraer QR code - puede venir en diferentes formatos
      let qrCodeData = null

      // Primero intentar obtener imagen base64
      if (data.qrcode?.base64) {
        qrCodeData = data.qrcode.base64.startsWith('data:')
          ? data.qrcode.base64
          : `data:image/png;base64,${data.qrcode.base64}`
      } else if (data.base64) {
        qrCodeData = data.base64.startsWith('data:')
          ? data.base64
          : `data:image/png;base64,${data.base64}`
      } else if (data.qrcode?.pairingCode) {
        // Si solo hay pairing code, usarlo (más corto que el code completo)
        qrCodeData = data.qrcode.pairingCode
      } else if (data.pairingCode) {
        qrCodeData = data.pairingCode
      } else if (data.qrcode?.code) {
        qrCodeData = data.qrcode.code
      } else if (data.qr) {
        qrCodeData = data.qr
      } else if (data.code) {
        qrCodeData = data.code
      }

      console.log('QR Code extracted:', qrCodeData ? 'Found' : 'Not found', 'Length:', qrCodeData?.length, 'Type:', qrCodeData?.startsWith('data:') ? 'image' : 'text')

      // Si no hay QR en la respuesta, intentar obtenerlo con connect
      if (!qrCodeData) {
        console.log('QR not found in create response, fetching with connect...')
        try {
          const connectResponse = await fetch(`${evolutionUrl}/instance/connect/${instanceName}`, {
            method: 'GET',
            headers: { apikey: evolutionKey },
          })

          if (connectResponse.ok) {
            const connectData = await connectResponse.json()
            console.log('Connect response:', connectData)

            // Primero intentar obtener imagen base64
            if (connectData.qrcode?.base64) {
              qrCodeData = connectData.qrcode.base64.startsWith('data:')
                ? connectData.qrcode.base64
                : `data:image/png;base64,${connectData.qrcode.base64}`
            } else if (connectData.base64) {
              qrCodeData = connectData.base64.startsWith('data:')
                ? connectData.base64
                : `data:image/png;base64,${connectData.base64}`
            } else if (connectData.qrcode?.pairingCode) {
              qrCodeData = connectData.qrcode.pairingCode
            } else if (connectData.pairingCode) {
              qrCodeData = connectData.pairingCode
            } else if (connectData.qrcode?.code) {
              qrCodeData = connectData.qrcode.code
            } else if (connectData.code) {
              qrCodeData = connectData.code
            }

            console.log('QR Code from connect:', qrCodeData ? 'Found' : 'Still not found', 'Type:', qrCodeData?.startsWith('data:') ? 'image' : 'text')
          }
        } catch (connectErr) {
          console.error('Error fetching QR with connect:', connectErr)
        }
      }

      // 2. Crear registro en DB
      const { data: line, error: dbError } = await supabase
        .from('whatsapp_lines')
        .insert({
          client_id: clientId,
          line_name: lineName.trim(),
          evolution_instance_name: instanceName,
          status: 'pending',
          qr_code: qrCodeData,
        })
        .select()
        .single()

      if (dbError) throw dbError

      setNewLineId(line.id)
      setQrCode(qrCodeData)

      // Iniciar polling del estado
      if (qrCodeData) {
        startPolling(line.id, instanceName)
      } else {
        console.warn('No QR code found, cannot start polling')
        setError('No se pudo generar el código QR. Intenta reconectar la línea.')
      }

      onLineAdded()
    } catch (err: any) {
      console.error('Error creating line:', err)
      setError(err.message || 'Error al crear la línea')
    } finally {
      setLoading(false)
    }
  }

  const startPolling = (lineId: string, instanceName: string) => {
    const interval = setInterval(async () => {
      try {
        const evolutionUrl = import.meta.env.VITE_EVOLUTION_API_URL
        const evolutionKey = import.meta.env.VITE_EVOLUTION_API_KEY

        const response = await fetch(
          `${evolutionUrl}/instance/connectionState/${instanceName}`,
          {
            headers: { apikey: evolutionKey },
          }
        )

        if (!response.ok) {
          console.warn('Failed to fetch connection state:', response.status)
          return
        }

        const data = await response.json()
        console.log('Connection state:', data)

        // La respuesta viene en formato: {"instance":{"state":"open"}}
        const state = data.instance?.state || data.state
        const isConnected = state === 'open'

        if (isConnected) {
          // Conectado exitosamente
          await supabase
            .from('whatsapp_lines')
            .update({
              status: 'connected',
              last_connected_at: new Date().toISOString(),
              qr_code: null, // Limpiar QR
            })
            .eq('id', lineId)

          clearInterval(interval)
          setQrCode(null)
          onLineAdded()

          // Obtener número de teléfono
          const phoneResponse = await fetch(
            `${evolutionUrl}/instance/fetchInstances?instanceName=${instanceName}`,
            {
              headers: { apikey: evolutionKey },
            }
          )

          if (phoneResponse.ok) {
            const phoneData = await phoneResponse.json()

            // Extraer número de ownerJid (formato: "573142428602@s.whatsapp.net")
            const ownerJid = phoneData[0]?.ownerJid || null

            if (ownerJid) {
              // Limpiar el formato de WhatsApp (@s.whatsapp.net)
              const phone = ownerJid.split('@')[0]

              await supabase
                .from('whatsapp_lines')
                .update({ phone_number: phone })
                .eq('id', lineId)
            }
          }
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 5000) // Poll cada 5 segundos (menos frecuente para evitar sobrecarga)

    // Timeout después de 3 minutos
    setTimeout(() => {
      clearInterval(interval)
      console.log('Polling timeout reached for', instanceName)
    }, 180000)
  }

  const handleClose = () => {
    setOpen(false)
    setLineName('')
    setQrCode(null)
    setNewLineId(null)
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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

  const loadData = useCallback(async () => {
    if (!user || !clientId || loadingClientId) return

    try {
      setLoading(true)

      // Obtener rol del usuario (o admin si es super_admin impersonalizando)
      const { data: membership } = await supabase
        .from('client_members')
        .select('role')
        .eq('auth_user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      setIsAdmin(membership?.role === 'super_admin' || membership?.role === 'admin')

      // Obtener límite de líneas usando clientId del hook
      const { data: clientData } = await supabase
        .from('clients')
        .select('max_whatsapp_lines')
        .eq('id', clientId)
        .single()

      if (clientData) {
        setMaxLines(clientData.max_whatsapp_lines)
      }

      // Obtener líneas usando clientId del hook
      const { data: linesData } = await supabase
        .from('whatsapp_lines')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

      setLines(linesData || [])

      // Obtener agentes usando clientId del hook
      const { data: agentsData } = await supabase
        .from('agents')
        .select('agent_id, business_name')
        .eq('client_id', clientId)
        .order('business_name')

      setAgents(agentsData || [])
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }, [user, clientId, loadingClientId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Polling automático para líneas pendientes
  useEffect(() => {
    const activePolls = new Map<string, NodeJS.Timeout>()

    const startPollingForLine = (line: WhatsAppLine) => {
      // No iniciar si ya existe un polling para esta línea
      if (activePolls.has(line.id)) {
        return
      }

      console.log('🔄 Starting auto-polling for pending line:', line.line_name, line.evolution_instance_name)

      const interval = setInterval(async () => {
        try {
          const evolutionUrl = import.meta.env.VITE_EVOLUTION_API_URL
          const evolutionKey = import.meta.env.VITE_EVOLUTION_API_KEY

          const response = await fetch(
            `${evolutionUrl}/instance/connectionState/${line.evolution_instance_name}`,
            {
              headers: { apikey: evolutionKey },
            }
          )

          if (!response.ok) {
            console.warn('⚠️ Failed to fetch connection state for', line.line_name, ':', response.status)
            return
          }

          const data = await response.json()
          console.log('📡 Auto-polling connection state for', line.line_name, ':', data)

          // La respuesta viene en formato: {"instance":{"state":"open"}}
          const state = data.instance?.state || data.state
          const isConnected = state === 'open'

          if (isConnected) {
            console.log('✅ Line connected!', line.line_name)

            // Detener polling para esta línea
            const poll = activePolls.get(line.id)
            if (poll) {
              clearInterval(poll)
              activePolls.delete(line.id)
            }

            // Actualizar en DB
            const { error: updateError } = await supabase
              .from('whatsapp_lines')
              .update({
                status: 'connected',
                last_connected_at: new Date().toISOString(),
                qr_code: null,
              })
              .eq('id', line.id)

            if (updateError) {
              console.error('❌ Error updating line status:', updateError)
              return
            }

            console.log('✅ Database updated successfully for', line.line_name)

            // Obtener número de teléfono
            try {
              const phoneResponse = await fetch(
                `${evolutionUrl}/instance/fetchInstances?instanceName=${line.evolution_instance_name}`,
                {
                  headers: { apikey: evolutionKey },
                }
              )

              if (phoneResponse.ok) {
                const phoneData = await phoneResponse.json()
                console.log('📱 Phone data:', phoneData)

                // Extraer número de ownerJid (formato: "573142428602@s.whatsapp.net")
                const ownerJid = phoneData[0]?.ownerJid || null
                let phone = null

                if (ownerJid) {
                  // Limpiar el formato de WhatsApp (@s.whatsapp.net)
                  phone = ownerJid.split('@')[0]
                  console.log('📞 Extracted phone number:', phone)

                  await supabase
                    .from('whatsapp_lines')
                    .update({ phone_number: phone })
                    .eq('id', line.id)
                }
              }
            } catch (phoneErr) {
              console.error('❌ Error fetching phone:', phoneErr)
            }

            // Recargar datos completos desde la DB
            console.log('🔄 Reloading data from database...')
            loadData()
          }
        } catch (err) {
          console.error('❌ Auto-polling error for', line.line_name, ':', err)
        }
      }, 5000) // Poll cada 5 segundos

      activePolls.set(line.id, interval)
    }

    // Iniciar polling solo para líneas pendientes
    lines.forEach((line) => {
      if (line.status === 'pending') {
        startPollingForLine(line)
      } else {
        // Si la línea ya no está pendiente, detener su polling si existe
        const poll = activePolls.get(line.id)
        if (poll) {
          clearInterval(poll)
          activePolls.delete(line.id)
        }
      }
    })

    // Cleanup: detener todos los intervals al desmontar
    return () => {
      console.log('🛑 Stopping all auto-polling intervals')
      activePolls.forEach((interval) => clearInterval(interval))
      activePolls.clear()
    }
  }, [lines, loadData])

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

  const handleDeleteLine = async (lineId: string, instanceName: string) => {
    try {
      // 1. Eliminar instancia de Evolution API
      const evolutionUrl = import.meta.env.VITE_EVOLUTION_API_URL
      const evolutionKey = import.meta.env.VITE_EVOLUTION_API_KEY

      if (evolutionUrl && evolutionKey) {
        await fetch(`${evolutionUrl}/instance/delete/${instanceName}`, {
          method: 'DELETE',
          headers: { apikey: evolutionKey },
        })
      }

      // 2. Eliminar de DB
      const { error } = await supabase
        .from('whatsapp_lines')
        .delete()
        .eq('id', lineId)

      if (error) throw error

      // Actualizar lista
      setLines((prev) => prev.filter((line) => line.id !== lineId))
    } catch (err) {
      console.error('Error deleting line:', err)
    }
  }

  const handleLogout = async (lineId: string, instanceName: string) => {
    try {
      console.log('Logging out instance:', instanceName)

      const evolutionUrl = import.meta.env.VITE_EVOLUTION_API_URL
      const evolutionKey = import.meta.env.VITE_EVOLUTION_API_KEY

      if (!evolutionUrl || !evolutionKey) {
        throw new Error('Evolution API no está configurada')
      }

      // Hacer logout en Evolution API
      const response = await fetch(`${evolutionUrl}/instance/logout/${instanceName}`, {
        method: 'DELETE',
        headers: { apikey: evolutionKey },
      })

      if (!response.ok) {
        console.error('Logout failed:', response.status, response.statusText)
        throw new Error('Error al desconectar')
      }

      console.log('✅ Logged out successfully')

      // Actualizar estado en DB a disconnected
      await supabase
        .from('whatsapp_lines')
        .update({
          status: 'disconnected',
          phone_number: null,
          qr_code: null,
        })
        .eq('id', lineId)

      loadData()
    } catch (err) {
      console.error('Error logging out:', err)
      alert('Error al desconectar. Revisa la consola para más detalles.')
    }
  }

  const handleReconnect = async (lineId: string, instanceName: string) => {
    try {
      console.log('Reconnecting instance:', instanceName)

      // Solicitar nuevo QR
      const evolutionUrl = import.meta.env.VITE_EVOLUTION_API_URL
      const evolutionKey = import.meta.env.VITE_EVOLUTION_API_KEY

      if (!evolutionUrl || !evolutionKey) {
        throw new Error('Evolution API no está configurada')
      }

      const response = await fetch(`${evolutionUrl}/instance/connect/${instanceName}`, {
        method: 'GET',
        headers: { apikey: evolutionKey },
      })

      if (!response.ok) {
        console.error('Reconnect failed:', response.status, response.statusText)
        throw new Error('Error al reconectar')
      }

      const data = await response.json()
      console.log('Reconnect response:', data)

      // Extraer QR code - puede venir en diferentes formatos
      let qrCodeData = null

      // Primero intentar obtener imagen base64
      if (data.qrcode?.base64) {
        qrCodeData = data.qrcode.base64.startsWith('data:')
          ? data.qrcode.base64
          : `data:image/png;base64,${data.qrcode.base64}`
      } else if (data.base64) {
        qrCodeData = data.base64.startsWith('data:')
          ? data.base64
          : `data:image/png;base64,${data.base64}`
      } else if (data.qrcode?.pairingCode) {
        // Si solo hay pairing code, usarlo (más corto que el code completo)
        qrCodeData = data.qrcode.pairingCode
      } else if (data.pairingCode) {
        qrCodeData = data.pairingCode
      } else if (data.qrcode?.code) {
        qrCodeData = data.qrcode.code
      } else if (data.qr) {
        qrCodeData = data.qr
      } else if (data.code) {
        qrCodeData = data.code
      }

      console.log('New QR Code extracted:', qrCodeData ? 'Found' : 'Not found', 'Length:', qrCodeData?.length, 'Type:', qrCodeData?.startsWith('data:') ? 'image' : 'text')

      // Actualizar QR en DB
      await supabase
        .from('whatsapp_lines')
        .update({
          qr_code: qrCodeData,
          status: 'pending',
        })
        .eq('id', lineId)

      loadData()
    } catch (err) {
      console.error('Error reconnecting:', err)
      alert('Error al renovar el QR. Revisa la consola para más detalles.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
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

            // Debug: log line data
            console.log('Rendering line:', {
              id: line.id,
              name: line.line_name,
              status: line.status,
              hasQR: !!line.qr_code,
              qrLength: line.qr_code?.length,
              qrPreview: line.qr_code?.substring(0, 50)
            })

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
                              onClick={() => handleReconnect(line.id, line.evolution_instance_name)}
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
                              onClick={() => loadData()}
                              className="h-6 text-xs"
                              title="Verificar si ya está conectado"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Verificar
                            </Button>
                          </div>
                          <div className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded p-2 mt-2">
                            💡 El QR expira en ~60 segundos. Si ya escaneaste, haz clic en "Verificar"
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
                                onClick={() => handleLogout(line.id, line.evolution_instance_name)}
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
                          onClick={() => handleReconnect(line.id, line.evolution_instance_name)}
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
                              onClick={() => handleDeleteLine(line.id, line.evolution_instance_name)}
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
