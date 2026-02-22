import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useClientContext } from '@/hooks/use-client-context'
import { supabase } from '@/lib/supabase'
import { MessageSquare, Loader2, Bot, User, Search, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Agent {
  agent_id: string
  business_name: string
}

interface Message {
  id: number
  role: 'user' | 'assistant'
  message: string
  created_at: string
}

interface Conversation {
  user_id: string
  agent_id: string
  agent_name: string
  last_message: string
  last_message_at: string
  message_count: number
}

const PAGE_SIZE = 50

export function WAInteractionsSection() {
  const { user } = useAuth()
  const { clientId, isLoading: loadingClientId } = useClientContext()

  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string>('all')
  const [allConversations, setAllConversations] = useState<Conversation[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [totalConversations, setTotalConversations] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)

  // 1. Cargar agentes del cliente
  useEffect(() => {
    if (!user || !clientId || loadingClientId) return
    const fetchAgents = async () => {
      setLoadingAgents(true)

      const { data } = await supabase
        .from('agents')
        .select('agent_id, business_name')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

      setAgents(data || [])
      setLoadingAgents(false)
    }
    fetchAgents()
  }, [user, clientId, loadingClientId])

  const fetchConversations = useCallback(async () => {
    if (!user || loadingAgents) return
      setLoadingConversations(true)
      setSelectedConversation(null)
      setMessages([])

      const agentIds = selectedAgent === 'all'
        ? agents.map(a => a.agent_id)
        : [selectedAgent]

      if (agentIds.length === 0) {
        setConversations([])
        setTotalConversations(0)
        setLoadingConversations(false)
        return
      }

      // Traer mensajes agrupados por user_id + agent_id
      const { data, error } = await supabase
        .from('chat_history')
        .select('user_id, agent_id, message, role, created_at')
        .in('agent_id', agentIds)
        .order('created_at', { ascending: false })

      if (error || !data) {
        setConversations([])
        setLoadingConversations(false)
        return
      }

      // Agrupar por user_id + agent_id
      const map = new Map<string, Conversation>()
      for (const row of data) {
        const key = `${row.user_id}__${row.agent_id}`
        if (!map.has(key)) {
          const agent = agents.find(a => a.agent_id === row.agent_id)
          map.set(key, {
            user_id: row.user_id,
            agent_id: row.agent_id,
            agent_name: agent?.business_name || row.agent_id,
            last_message: row.message,
            last_message_at: row.created_at,
            message_count: 1,
          })
        } else {
          map.get(key)!.message_count++
        }
      }

      let convList = Array.from(map.values())

      // Filtrar por búsqueda
      if (search.trim()) {
        convList = convList.filter(c =>
          c.user_id.toLowerCase().includes(search.toLowerCase()) ||
          c.agent_name.toLowerCase().includes(search.toLowerCase()) ||
          c.last_message.toLowerCase().includes(search.toLowerCase())
        )
      }

      setTotalConversations(convList.length)
      setAllConversations(convList)
      setConversations(convList.slice(0, PAGE_SIZE))
      setPage(0)
      setLoadingConversations(false)
  }, [user, agents, selectedAgent, search, loadingAgents])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations, refreshKey])

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1)
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  // 3. Cargar mensajes de la conversación seleccionada
  useEffect(() => {
    if (!selectedConversation) return
    const fetchMessages = async () => {
      setLoadingMessages(true)
      const { data } = await supabase
        .from('chat_history')
        .select('id, role, message, created_at')
        .eq('agent_id', selectedConversation.agent_id)
        .eq('user_id', selectedConversation.user_id)
        .order('created_at', { ascending: true })

      setMessages((data as Message[]) || [])
      setLoadingMessages(false)
    }
    fetchMessages()
  }, [selectedConversation])

  const hasMore = conversations.length < totalConversations

  const loadMore = () => {
    const nextPage = page + 1
    const nextConvs = allConversations.slice(0, (nextPage + 1) * PAGE_SIZE)
    setConversations(nextConvs)
    setPage(nextPage)
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

  const shortUserId = (uid: string) =>
    uid.length > 20 ? `${uid.substring(0, 10)}...${uid.substring(uid.length - 6)}` : uid

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Interacciones WA</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {totalConversations} conversación{totalConversations !== 1 ? 'es' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey(prev => prev + 1)}
            disabled={loadingConversations}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", loadingConversations && "animate-spin")} />
            Actualizar
          </Button>

          <div className="w-56">
          {loadingAgents ? (
            <div className="h-9 bg-secondary rounded-lg animate-pulse" />
          ) : (
            <Select value={selectedAgent} onValueChange={(v) => { setSelectedAgent(v) }}>
              <SelectTrigger className="bg-secondary/50 border-2 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los agentes</SelectItem>
                {agents.map(a => (
                  <SelectItem key={a.agent_id} value={a.agent_id}>{a.business_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          </div>
        </div>
      </div>

      {/* Layout WhatsApp */}
      <div className="flex flex-1 min-h-0 border border-border rounded-2xl overflow-hidden bg-card">

        {/* Panel izquierdo — lista de conversaciones */}
        <div className="w-80 shrink-0 flex flex-col border-r border-border min-h-0">
          {/* Buscador */}
          <div className="p-3 border-b border-border shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value) }}
                placeholder="Buscar conversación..."
                className="pl-8 h-8 text-sm bg-secondary/50 border-0"
              />
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loadingConversations ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 px-4 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No hay conversaciones</p>
              </div>
            ) : (
              <>
                {conversations.map((conv) => (
                  <button
                    key={`${conv.user_id}__${conv.agent_id}`}
                    onClick={() => setSelectedConversation(conv)}
                    className={cn(
                      'w-full text-left px-4 py-3 border-b border-border/50 hover:bg-secondary/50 transition-colors',
                      selectedConversation?.user_id === conv.user_id &&
                      selectedConversation?.agent_id === conv.agent_id
                        ? 'bg-primary/10 border-l-2 border-l-primary'
                        : ''
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm font-medium text-foreground truncate">
                            {shortUserId(conv.user_id)}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                            {formatDate(conv.last_message_at)}
                          </span>
                        </div>
                        <p className="text-xs text-primary/70 mb-0.5 truncate">{conv.agent_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                      </div>
                      <span className="text-[10px] bg-primary/20 text-primary rounded-full px-1.5 py-0.5 shrink-0 font-medium">
                        {conv.message_count}
                      </span>
                    </div>
                  </button>
                ))}
                {hasMore && (
                  <div className="p-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadMore}
                      className="w-full text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cargar más ({totalConversations - conversations.length} restantes)
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Panel derecho — mensajes */}
        <div className="flex-1 flex flex-col">
          {!selectedConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-primary/40" />
              </div>
              <p className="text-muted-foreground text-sm">Selecciona una conversación para ver los mensajes</p>
            </div>
          ) : (
            <>
              {/* Header conversación */}
              <div className="px-5 py-3 border-b border-border bg-card/80 flex items-center gap-3 shrink-0">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{shortUserId(selectedConversation.user_id)}</p>
                  <p className="text-xs text-primary/70">{selectedConversation.agent_name}</p>
                </div>
                <div className="ml-auto text-xs text-muted-foreground">
                  {messages.length} mensajes
                </div>
              </div>

              {/* Mensajes */}
              <div
                className="flex-1 overflow-y-auto p-4 flex flex-col gap-2"
                style={{
                  background: 'linear-gradient(to bottom, hsl(var(--background)), hsl(var(--secondary)/0.3))'
                }}
              >
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex gap-2 max-w-[75%]',
                        msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'
                      )}
                    >
                      {/* Avatar */}
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-auto',
                        msg.role === 'user' ? 'bg-primary/20' : 'bg-secondary'
                      )}>
                        {msg.role === 'user'
                          ? <User className="h-3 w-3 text-primary" />
                          : <Bot className="h-3 w-3 text-muted-foreground" />
                        }
                      </div>

                      {/* Burbuja */}
                      <div className={cn(
                        'rounded-2xl px-3 py-2 text-sm shadow-sm',
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-tr-none'
                          : 'bg-card border border-border text-foreground rounded-tl-none'
                      )}>
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>
                        <p className={cn(
                          'text-[10px] mt-1 text-right',
                          msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        )}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
