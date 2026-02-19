import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AgentsSection } from '@/components/dashboard/AgentsSection'

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

type SectionId = typeof NAV_ITEMS[number]['id']

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
  const [collapsed, setCollapsed] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionId>('overview')

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const activeItem = NAV_ITEMS.find((i) => i.id === activeSection)!

  const userInitial = (user?.user_metadata?.name || user?.email || 'U')
    .charAt(0)
    .toUpperCase()

  const userName = user?.user_metadata?.name || user?.email || 'Usuario'

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'relative flex flex-col border-r border-border bg-card transition-all duration-300 shrink-0',
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
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
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
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-foreground font-semibold">{activeItem.label}</span>
          </div>

          {/* User info */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end leading-none">
              <span className="text-sm font-medium text-foreground">{userName}</span>
              {user?.user_metadata?.name && (
                <span className="text-xs text-muted-foreground">{user.email}</span>
              )}
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-primary/30">
              {userInitial}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeSection === 'agents' ? (
            <AgentsSection />
          ) : (
            <SectionPlaceholder
              id={activeSection}
              label={activeItem.label}
              icon={activeItem.icon}
            />
          )}
        </main>
      </div>
    </div>
  )
}
