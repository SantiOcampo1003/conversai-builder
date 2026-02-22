import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  Bot,
  LayoutDashboard,
  LogOut,
  Zap,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Wifi,
  BarChart3,
  Users,
  Shield,
  AlertCircle,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AgentsSection } from '@/components/dashboard/AgentsSection'
import { WAInteractionsSection } from '@/components/dashboard/WAInteractionsSection'
import { WAConnectionsSection } from '@/components/dashboard/WAConnectionsSection'
import { OverviewSection } from '@/components/dashboard/OverviewSection'
import { AccountSection } from '@/components/dashboard/AccountSection'
import { TokensSection } from '@/components/dashboard/TokensSection'
import { AgentUsageSection } from '@/components/dashboard/AgentUsageSection'
import { SuperAdminSection } from '@/components/dashboard/SuperAdminSection'
import { FeedbackDialog } from '@/components/FeedbackDialog'
import { Button } from '@/components/ui/button'
import { useIsSuperAdmin } from '@/hooks/use-is-super-admin'
import { useClientContext } from '@/hooks/use-client-context'

// ── Secciones del sidebar ──────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'overview',       label: 'Panel General',        icon: LayoutDashboard },
  { id: 'agents',         label: 'Agentes',              icon: Bot },
  { id: 'wa-interactions',label: 'Interacciones WA',     icon: MessageSquare },
  { id: 'wa-connections', label: 'Conexiones WA',        icon: Wifi },
  { id: 'usage',          label: 'Uso de Agentes',       icon: BarChart3 },
  { id: 'tokens',         label: 'Tokens',               icon: Zap },
  { id: 'account',        label: 'Cuenta y Equipo',      icon: Users },
] as const

type SectionId = typeof NAV_ITEMS[number]['id'] | 'super-admin'

// ── Placeholder de cada sección ────────────────────────────────────────────
function SectionPlaceholder({ id, label, icon: Icon }: { id: SectionId; label: string; icon: React.ElementType }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{label}</h1>
        <p className="text-muted-foreground text-sm mt-1">Sección en construcción</p>
      </div>
      <div className="border-2 border-dashed border-border rounded-2xl p-16 flex flex-col items-center justify-center gap-4">
        <div className="bg-primary/10 rounded-full p-5 shadow-lg shadow-primary/20">
          <Icon className="h-10 w-10 text-primary" />
        </div>
        <p className="text-muted-foreground text-center max-w-xs">
          Aquí aparecerá el contenido de <span className="text-primary font-medium">{label}</span>.
        </p>
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────
export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { section } = useParams<{ section: string }>()
  const [collapsed, setCollapsed] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [allowedSections, setAllowedSections] = useState<Set<string> | null>(null) // null = loading
  const [availableTokens, setAvailableTokens] = useState<number | null>(null)
  const [clientName, setClientName] = useState<string | null>(null)
  const [feedbackExpanded, setFeedbackExpanded] = useState(true)
  const [feedbackHover, setFeedbackHover] = useState(false)
  const { isSuperAdmin, isLoading: loadingSuperAdmin } = useIsSuperAdmin()
  const { clientId, isLoading: loadingClientId } = useClientContext()
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [impersonationData, setImpersonationData] = useState<any>(null)
  const [impersonatedClientName, setImpersonatedClientName] = useState<string>('')

  // Determinar la sección activa desde la URL
  const activeSection = (section || 'overview') as SectionId

  // Detectar si estamos impersonalizando
  useEffect(() => {
    const impersonation = sessionStorage.getItem('super_admin_impersonating')
    if (impersonation) {
      const data = JSON.parse(impersonation)
      setIsImpersonating(true)
      setImpersonationData(data)

      // Cargar nombre del cliente impersonalizado
      const loadClientName = async () => {
        const { data: client } = await supabase
          .from('clients')
          .select('name, company_name')
          .eq('id', data.targetClientId)
          .single()

        if (client) {
          setImpersonatedClientName(client.company_name || client.name)
        }
      }
      loadClientName()
    }
  }, [])

  // Cargar rol y permisos del usuario actual
  useEffect(() => {
    if (!user || loadingClientId) return

    const loadPermissions = async () => {
      // Obtener membresía del usuario autenticado
      const { data: membership } = await supabase
        .from('client_members')
        .select('id, role')
        .eq('auth_user_id', user.id)
        .eq('status', 'active')
        .single()

      if (!membership) {
        setAllowedSections(new Set())
        return
      }

      // Si es super_admin, darle acceso completo (incluso cuando impersonaliza)
      if (membership.role === 'super_admin') {
        setUserRole('admin') // Mostrar como admin en la UI
        setAllowedSections(new Set(NAV_ITEMS.map(i => i.id)))
        return
      }

      // Si hay clientId y NO es super admin, verificar membresía en el cliente actual
      if (clientId) {
        const { data: clientMembership } = await supabase
          .from('client_members')
          .select('id, role')
          .eq('client_id', clientId)
          .eq('auth_user_id', user.id)
          .eq('status', 'active')
          .single()

        if (clientMembership) {
          setUserRole(clientMembership.role)

          // Admin tiene acceso a todo
          if (clientMembership.role === 'admin') {
            setAllowedSections(new Set(NAV_ITEMS.map(i => i.id)))
            return
          }

          // Cargar permisos desde member_permissions
          const { data: perms } = await supabase
            .from('member_permissions')
            .select('section, permissions')
            .eq('member_id', clientMembership.id)

          // Solo mostrar secciones donde tiene al menos 'view'
          const allowed = new Set<string>()
          for (const p of perms || []) {
            if (Array.isArray(p.permissions) && p.permissions.includes('view')) {
              allowed.add(p.section)
            }
          }
          // 'account' siempre visible para que pueda ver sus propios datos
          allowed.add('account')
          setAllowedSections(allowed)
          return
        }
      }

      // Fallback: usar la membresía original
      setUserRole(membership.role)
      if (membership.role === 'admin') {
        setAllowedSections(new Set(NAV_ITEMS.map(i => i.id)))
        return
      }

      // Cargar permisos desde member_permissions
      const { data: perms } = await supabase
        .from('member_permissions')
        .select('section, permissions')
        .eq('member_id', membership.id)

      const allowed = new Set<string>()
      for (const p of perms || []) {
        if (Array.isArray(p.permissions) && p.permissions.includes('view')) {
          allowed.add(p.section)
        }
      }
      allowed.add('account')
      setAllowedSections(allowed)
    }

    const loadTokens = async () => {
      if (!clientId || loadingClientId) return

      try {
        // Obtener información del cliente
        const { data: client, error: clientError } = await supabase
          .from('clients')
          .select('company_name, name')
          .eq('id', clientId)
          .single()

        if (!clientError && client) {
          setClientName(client.company_name || client.name)
        }

        const { data: balance, error: balanceError } = await supabase
          .from('token_balances')
          .select('available_tokens')
          .eq('client_id', clientId)
          .single()

        if (balanceError) {
          console.error('Error loading token balance:', balanceError)
          return
        }

        if (balance) {
          setAvailableTokens(balance.available_tokens)
        }
      } catch (err) {
        console.error('Error in loadTokens:', err)
      }
    }

    loadPermissions()
    loadTokens()
  }, [user, clientId, loadingClientId])

  // Redirigir si la sección actual no está permitida
  useEffect(() => {
    if (allowedSections === null) return // Aún cargando permisos

    // Si la sección es super-admin, verificar si es super admin
    if (activeSection === 'super-admin' && !isSuperAdmin) {
      const firstAllowed = Array.from(allowedSections)[0] as SectionId ?? 'account'
      navigate(`/dashboard/${firstAllowed}`, { replace: true })
      return
    }

    // Si la sección no está permitida, redirigir a la primera permitida
    if (!allowedSections.has(activeSection) && activeSection !== 'super-admin') {
      const firstAllowed = Array.from(allowedSections)[0] as SectionId ?? 'account'
      navigate(`/dashboard/${firstAllowed}`, { replace: true })
    }
  }, [activeSection, allowedSections, isSuperAdmin, navigate])

  // Animar botón de feedback al cargar y cada minuto
  useEffect(() => {
    // Expandir inicialmente
    setFeedbackExpanded(true)
    const collapseTimer = setTimeout(() => {
      setFeedbackExpanded(false)
    }, 3000)

    // Expandir cada minuto
    const expandInterval = setInterval(() => {
      setFeedbackExpanded(true)
      setTimeout(() => {
        setFeedbackExpanded(false)
      }, 3000)
    }, 60000) // Cada 60 segundos

    return () => {
      clearTimeout(collapseTimer)
      clearInterval(expandInterval)
    }
  }, []) // Solo al montar el componente

  const handleExitImpersonation = () => {
    sessionStorage.removeItem('super_admin_impersonating')
    // Disparar evento para que otros componentes se enteren
    window.dispatchEvent(new Event('impersonation-changed'))
    window.location.href = '/dashboard/super-admin'
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  // Construir nav items dinámicamente (agregar super-admin si aplica)
  const navItems = [
    ...NAV_ITEMS,
    ...(isSuperAdmin ? [{ id: 'super-admin' as const, label: 'Super Admin', icon: Shield }] : []),
  ]

  // Filtrar nav items según permisos (null = aún cargando, mostrar todo temporalmente)
  const visibleNavItems = allowedSections === null
    ? navItems
    : navItems.filter(i => allowedSections.has(i.id) || i.id === 'super-admin')

  const activeItem = navItems.find((i) => i.id === activeSection)!

  const userInitial = (user?.user_metadata?.name || user?.email || 'U')
    .charAt(0)
    .toUpperCase()

  const userName = user?.user_metadata?.name || user?.email || 'Usuario'

  return (
    <div className="h-screen overflow-hidden bg-background flex">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'relative flex flex-col border-r border-border bg-card transition-all duration-300 shrink-0 h-full',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'h-16 flex items-center border-b border-border px-3 gap-3 shrink-0',
          collapsed && 'justify-center px-0'
        )}>
          <div className="relative shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-lg shadow-primary/40">
              <span className="text-xl font-black text-white">e</span>
            </div>
            <div className="absolute inset-0 bg-primary/20 rounded-lg blur-md animate-pulse" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-none">
              <span className="text-lg font-black gradient-text tracking-tight">easy</span>
              <span className="text-[9px] text-primary/70 tracking-wider">AI AGENTS</span>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 flex flex-col gap-1 px-2 overflow-y-auto">
          {visibleNavItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(`/dashboard/${id}`)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium transition-all duration-150 w-full text-left group',
                activeSection === id
                  ? 'bg-primary/15 text-primary shadow-sm shadow-primary/20'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                collapsed && 'justify-center px-0'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className={cn(
                'h-4 w-4 shrink-0',
                activeSection === id ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
              )} />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          ))}
        </nav>

        {/* Sign out */}
        <div className="border-t border-border p-2">
          <button
            onClick={handleSignOut}
            className={cn(
              'flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all w-full',
              collapsed && 'justify-center px-0'
            )}
            title={collapsed ? 'Cerrar sesión' : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/50 transition-all shadow-sm"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 h-full relative">
        {/* Top bar */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            {availableTokens !== null && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-full">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  {new Intl.NumberFormat('es-ES').format(availableTokens)} tokens
                </span>
              </div>
            )}
          </div>

          {/* User info */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end leading-none">
              <span className="text-sm font-medium text-foreground">{userName}</span>
              {user?.user_metadata?.name && (
                <span className="text-xs text-muted-foreground">{user.email}</span>
              )}
              {clientName && (
                <span className="text-xs font-medium text-primary mt-0.5">
                  {clientName}
                </span>
              )}
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-primary/30">
              {userInitial}
            </div>
          </div>
        </header>

        {/* Impersonation Banner */}
        {isImpersonating && (
          <div className="bg-amber-500 text-white px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-semibold">
                  Modo Super Admin: Accediendo como {impersonatedClientName || 'Cliente'}
                </p>
                <p className="text-xs opacity-90">
                  Estás viendo el dashboard del cliente. Puedes realizar configuraciones en su nombre.
                </p>
              </div>
            </div>
            <Button
              onClick={handleExitImpersonation}
              variant="secondary"
              size="sm"
              className="gap-2 bg-white text-amber-600 hover:bg-amber-50"
            >
              <Shield className="h-4 w-4" />
              Volver a Super Admin
            </Button>
          </div>
        )}

        {/* Content */}
        <main className={cn(
          'flex-1 min-h-0 p-6',
          activeSection === 'wa-interactions'
            ? 'overflow-hidden flex flex-col'
            : 'overflow-y-auto'
        )}>
          {activeSection === 'overview' ? (
            <OverviewSection />
          ) : activeSection === 'agents' ? (
            <AgentsSection />
          ) : activeSection === 'wa-interactions' ? (
            <WAInteractionsSection />
          ) : activeSection === 'wa-connections' ? (
            <WAConnectionsSection />
          ) : activeSection === 'usage' ? (
            <AgentUsageSection />
          ) : activeSection === 'tokens' ? (
            <TokensSection />
          ) : activeSection === 'account' ? (
            <AccountSection />
          ) : activeSection === 'super-admin' ? (
            <SuperAdminSection />
          ) : (
            <SectionPlaceholder
              id={activeSection}
              label={activeItem.label}
              icon={activeItem.icon}
            />
          )}
        </main>

        {/* Floating Feedback Button */}
        <div
          className="fixed bottom-6 right-6 z-50"
          onMouseEnter={() => setFeedbackHover(true)}
          onMouseLeave={() => setFeedbackHover(false)}
        >
          <div className="w-[152px] h-14 flex items-center justify-end">
            <FeedbackDialog
              trigger={
                <Button
                  size="lg"
                  className={cn(
                    "rounded-full shadow-2xl shadow-primary/30 h-14 bg-gradient-to-br from-primary to-primary/90 hover:from-primary/90 hover:to-primary hover:scale-105 transition-all duration-300 flex items-center",
                    (feedbackExpanded || feedbackHover) ? "px-6 gap-2 justify-start" : "w-14 px-0 justify-center"
                  )}
                >
                  <MessageSquare className={cn("h-5 w-5 shrink-0", !(feedbackExpanded || feedbackHover) && "mx-auto")} />
                  <span
                    className={cn(
                      "font-semibold whitespace-nowrap overflow-hidden transition-all duration-300",
                      (feedbackExpanded || feedbackHover) ? "max-w-[100px] opacity-100" : "max-w-0 opacity-0"
                    )}
                  >
                    Feedback
                  </span>
                </Button>
              }
              defaultCategory={
                activeSection === 'overview' ? 'dashboard' :
                activeSection === 'agents' ? 'agents' :
                activeSection === 'wa-interactions' ? 'whatsapp' :
                activeSection === 'wa-connections' ? 'whatsapp' :
                activeSection === 'usage' ? 'dashboard' :
                activeSection === 'tokens' ? 'tokens' :
                activeSection === 'account' ? 'general' :
                'general'
              }
              metadata={{
                section: activeSection,
                userRole: userRole,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
