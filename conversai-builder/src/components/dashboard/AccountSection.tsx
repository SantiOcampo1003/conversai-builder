import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { usePreferencesStore } from '@/stores/usePreferencesStore'
import { useClientContext } from '@/hooks/use-client-context'
import {
  Palette, Users, Shield, Loader2, Trash2, Check, Sun, Moon,
  UserPlus, ChevronDown, ChevronUp, Copy, Mail,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────
type TabId = 'appearance' | 'team' | 'permissions'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'team',        label: 'Equipo',       icon: Users },
  { id: 'permissions', label: 'Permisos',     icon: Shield },
  { id: 'appearance',  label: 'Apariencia',  icon: Palette },
]

const SECTIONS = [
  { id: 'overview',        label: 'Panel General' },
  { id: 'agents',          label: 'Agentes' },
  { id: 'wa-interactions', label: 'Interacciones WA' },
  { id: 'wa-connections',  label: 'Conexiones WA' },
  { id: 'usage',           label: 'Uso de Agentes' },
  { id: 'tokens',          label: 'Tokens' },
  { id: 'account',         label: 'Cuenta y Equipo' },
] as const

type SectionId = typeof SECTIONS[number]['id']

const ALL_PERMS = ['view', 'edit', 'create', 'delete'] as const
type Perm = typeof ALL_PERMS[number]

interface Member {
  id: string
  auth_user_id: string
  role: string
  status: string
  email: string | null
  full_name: string | null
  invite_token?: string | null
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function AccountSection() {
  const [activeTab, setActiveTab] = useState<TabId>('team')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cuenta y Equipo</h1>
        <p className="text-muted-foreground text-sm mt-1">Personaliza tu experiencia y gestiona tu equipo</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px',
              activeTab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'appearance'  && <AppearanceTab />}
      {activeTab === 'team'        && <TeamTab />}
      {activeTab === 'permissions' && <PermissionsTab />}
    </div>
  )
}

// ── Tab: Apariencia ────────────────────────────────────────────────────────────
function AppearanceTab() {
  const { fontSize, setFontSize, theme, setTheme } = usePreferencesStore()

  const fontSizes = [
    { value: 'sm' as const, label: 'A', desc: 'Pequeño', size: 'text-xs' },
    { value: 'md' as const, label: 'A', desc: 'Normal',  size: 'text-sm' },
    { value: 'lg' as const, label: 'A', desc: 'Grande',  size: 'text-base' },
  ]

  return (
    <div className="flex flex-col gap-8 max-w-lg">
      {/* Tema */}
      <div className="flex flex-col gap-3">
        <Label className="text-sm font-semibold">Tema</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setTheme('dark')}
            className={cn(
              'flex flex-col items-center gap-3 rounded-xl p-4 border-2 transition-all',
              theme === 'dark'
                ? 'border-primary bg-primary/10'
                : 'border-border bg-secondary/30 hover:border-primary/40'
            )}
          >
            <div className="w-full h-16 rounded-lg bg-[hsl(220_13%_9%)] border border-[hsl(220_13%_20%)] flex items-center justify-center">
              <Moon className="h-5 w-5 text-[hsl(142_86%_42%)]" />
            </div>
            <div className="flex items-center gap-2">
              {theme === 'dark' && <Check className="h-3.5 w-3.5 text-primary" />}
              <span className="text-sm font-medium">Oscuro</span>
            </div>
          </button>

          <button
            onClick={() => setTheme('light')}
            className={cn(
              'flex flex-col items-center gap-3 rounded-xl p-4 border-2 transition-all',
              theme === 'light'
                ? 'border-primary bg-primary/10'
                : 'border-border bg-secondary/30 hover:border-primary/40'
            )}
          >
            <div className="w-full h-16 rounded-lg bg-[hsl(210_20%_96%)] border border-[hsl(210_20%_82%)] flex items-center justify-center">
              <Sun className="h-5 w-5 text-[hsl(142_86%_35%)]" />
            </div>
            <div className="flex items-center gap-2">
              {theme === 'light' && <Check className="h-3.5 w-3.5 text-primary" />}
              <span className="text-sm font-medium">Claro</span>
            </div>
          </button>
        </div>
      </div>

      {/* Tamaño de fuente */}
      <div className="flex flex-col gap-3">
        <Label className="text-sm font-semibold">Tamaño de letra</Label>
        <div className="flex gap-3">
          {fontSizes.map(f => (
            <button
              key={f.value}
              onClick={() => setFontSize(f.value)}
              className={cn(
                'flex-1 flex flex-col items-center gap-2 rounded-xl p-4 border-2 transition-all',
                fontSize === f.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-secondary/30 hover:border-primary/40'
              )}
            >
              <span className={cn('font-bold text-foreground leading-none', f.size)}>
                {f.label}
              </span>
              <span className="text-[10px] text-muted-foreground">{f.desc}</span>
              {fontSize === f.value && <Check className="h-3 w-3 text-primary" />}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">El cambio se aplica inmediatamente en todo el dashboard</p>
      </div>
    </div>
  )
}

// ── Tab: Equipo ────────────────────────────────────────────────────────────────
function TeamTab() {
  const { user } = useAuth()
  const { clientId, isLoading: loadingClientId } = useClientContext()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [myRole, setMyRole] = useState<string>('')

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('billing')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [inviteWarning, setInviteWarning] = useState<string | null>(null)
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null)
  const [resending, setResending] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !clientId || loadingClientId) return
    const load = async () => {
      setLoading(true)

      // Obtener rol del usuario actual en el cliente (o super_admin si está impersonalizando)
      const { data: me } = await supabase
        .from('client_members')
        .select('role')
        .eq('auth_user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      // Si es super admin impersonalizando, darle permisos de admin
      setMyRole(me?.role === 'super_admin' ? 'admin' : (me?.role || 'viewer'))

      // Usar función RPC que obtiene miembros con emails desde auth.users
      const { data: allMembers } = await supabase.rpc('get_client_members_with_email', {
        p_client_id: clientId
      })

      setMembers((allMembers as Member[]) || [])
      setLoading(false)
    }
    load()
  }, [user, clientId, loadingClientId])

  const isAdmin = myRole === 'admin'

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !inviteEmail.trim()) return
    setInviting(true)
    setInviteError(null)
    setInviteWarning(null)

    try {
      const { data: newMember, error } = await supabase
        .from('client_members')
        .insert({
          client_id: clientId,
          auth_user_id: '00000000-0000-0000-0000-000000000000',
          role: inviteRole,
          status: 'pending',
          invite_email: inviteEmail,
          invited_at: new Date().toISOString(),
        })
        .select('id, invite_token')
        .single()

      if (error) throw error

      await supabase.rpc('create_default_permissions_for_role', {
        p_member_id: newMember.id,
        p_role: inviteRole,
      })

      const inviteUrl = `${window.location.origin}/accept-invite?token=${newMember.invite_token}`
      setLastInviteUrl(inviteUrl)

      try {
        // Obtener información del cliente para el email
        const { data: clientData } = await supabase
          .from('clients')
          .select('company_name, name')
          .eq('id', clientId)
          .single()

        // Obtener nombre del invitador (del user metadata o email)
        const inviterName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Admin'

        const emailResponse = await fetch(import.meta.env.VITE_EMAIL_ENDPOINT_URL as string, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: inviteEmail,
            template: 'invitation',
            params: {
              inviterName,
              inviterCompany: clientData?.company_name || clientData?.name || 'ConversAI Builder',
              invitationUrl: inviteUrl,
              role: inviteRole,
            },
          }),
        })

        if (!emailResponse.ok) {
          throw new Error('Email service failed')
        }

        setInviteSuccess(true)
      } catch (emailErr) {
        console.error('Error sending email:', emailErr)
        setInviteWarning('Invitación creada pero el email no se pudo enviar. Usa "Reenviar email" o copia el link.')
      }

      setInviteEmail('')
      setTimeout(() => {
        setInviteSuccess(false)
        setInviteWarning(null)
      }, 5000)

      // Recargar miembros del cliente actual usando RPC
      const { data: allMembers } = await supabase.rpc('get_client_members_with_email', {
        p_client_id: clientId
      })

      setMembers((allMembers as Member[]) || [])
    } catch (err) {
      console.error('Error inviting:', err)
      setInviteError('Error al invitar. Verifica que el usuario no esté ya en el equipo.')
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (memberId: string) => {
    await supabase.from('client_members').delete().eq('id', memberId)
    setMembers(prev => prev.filter(m => m.id !== memberId))
  }

  const handleResendInvite = async (member: Member) => {
    if (!member.invite_token || !clientId) return

    setResending(member.id)
    try {
      const inviteUrl = `${window.location.origin}/accept-invite?token=${member.invite_token}`

      // Obtener información del cliente para el email
      const { data: clientData } = await supabase
        .from('clients')
        .select('company_name, name')
        .eq('id', clientId)
        .single()

      // Obtener nombre del invitador
      const inviterName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Admin'

      const response = await fetch(import.meta.env.VITE_EMAIL_ENDPOINT_URL as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: member.email,
          template: 'invitation',
          params: {
            inviterName,
            inviterCompany: clientData?.company_name || clientData?.name || 'ConversAI Builder',
            invitationUrl: inviteUrl,
            role: member.role,
          },
        }),
      })

      if (!response.ok) {
        setInviteError('Error al reenviar el email. Intenta copiando el link manualmente.')
        setTimeout(() => setInviteError(null), 3000)
      } else {
        setInviteSuccess(true)
        setTimeout(() => setInviteSuccess(false), 3000)
      }
    } catch (err) {
      console.error('Error resending invite:', err)
      setInviteError('Error al reenviar el email. Intenta copiando el link manualmente.')
      setTimeout(() => setInviteError(null), 3000)
    } finally {
      setResending(null)
    }
  }

  const handleCopyLink = async () => {
    if (!lastInviteUrl) return
    try {
      await navigator.clipboard.writeText(lastInviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Error copying to clipboard:', err)
    }
  }

  const handleCopyMemberLink = async (member: Member) => {
    if (!member.invite_token) return
    try {
      const inviteUrl = `${window.location.origin}/accept-invite?token=${member.invite_token}`
      await navigator.clipboard.writeText(inviteUrl)
      setCopiedMemberId(member.id)
      setTimeout(() => setCopiedMemberId(null), 2000)
    } catch (err) {
      console.error('Error copying to clipboard:', err)
    }
  }

  const roleColors: Record<string, string> = {
    'admin':         'bg-primary/20 text-primary',
    'billing':       'bg-emerald-500/20 text-emerald-400',
    'viewer':        'bg-secondary text-muted-foreground',
    'agent-manager': 'bg-amber-500/20 text-amber-400',
    'pending':       'bg-orange-500/20 text-orange-400',
  }

  const roleLabels: Record<string, string> = {
    'admin':         'Admin',
    'billing':       'Facturación',
    'viewer':        'Solo lectura',
    'agent-manager': 'Gestor de agentes',
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <div className="h-5 w-24 bg-secondary rounded animate-pulse" />
          </div>
          <div className="divide-y divide-border">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-secondary animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-secondary rounded animate-pulse" />
                  <div className="h-3 w-32 bg-secondary/50 rounded animate-pulse" />
                </div>
                <div className="h-6 w-20 bg-secondary rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Member list */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-semibold">{members.length} miembro{members.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="divide-y divide-border">
          {members.map(m => {
            const isMe = m.auth_user_id === user?.id
            const displayName = m.full_name || m.email || `Usuario ${m.id.substring(0, 8)}`
            const initial = displayName.charAt(0).toUpperCase()
            return (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {displayName}{isMe && <span className="text-xs text-muted-foreground ml-1">(tú)</span>}
                  </p>
                  {m.email && m.full_name && (
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  )}
                </div>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', roleColors[m.status === 'pending' ? 'pending' : m.role] || 'bg-secondary text-muted-foreground')}>
                  {m.status === 'pending' ? 'Pendiente' : (roleLabels[m.role] || m.role)}
                </span>
                {isAdmin && !isMe && m.status === 'pending' && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResendInvite(m)}
                          disabled={resending === m.id}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                        >
                          {resending === m.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Mail className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Reenviar email de invitación</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyMemberLink(m)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                        >
                          {copiedMemberId === m.id ? (
                            <Check className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{copiedMemberId === m.id ? '¡Copiado!' : 'Copiar link de invitación'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}
                {isAdmin && !isMe && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar miembro del equipo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. El usuario {displayName} perderá acceso al dashboard de este cliente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleRemove(m.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Invite form — solo admin */}
      {isAdmin && (
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Invitar miembro</p>
          </div>
          <form onSubmit={handleInvite} className="flex flex-col gap-3">
            <div className="flex gap-3">
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="flex-1"
                required
              />
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="billing">Facturación</SelectItem>
                  <SelectItem value="viewer">Solo lectura</SelectItem>
                  <SelectItem value="agent-manager">Gestor de agentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
            {inviteSuccess && <p className="text-xs text-primary flex items-center gap-1"><Check className="h-3 w-3" /> Invitación enviada correctamente</p>}
            {inviteWarning && <p className="text-xs text-amber-600 flex items-center gap-1"><Mail className="h-3 w-3" /> {inviteWarning}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={inviting} className="gap-2">
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Invitar
              </Button>
              {lastInviteUrl && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="gap-2"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copiado' : 'Copiar link'}
                </Button>
              )}
            </div>
          </form>
          <p className="text-xs text-muted-foreground">El usuario recibirá un email con el link de invitación. Si el email falla, puedes copiarlo manualmente o reenviarlo desde la lista de miembros.</p>
        </div>
      )}
    </div>
  )
}

// ── Tab: Permisos ──────────────────────────────────────────────────────────────
function PermissionsTab() {
  const { user } = useAuth()
  const { clientId, isLoading: loadingClientId } = useClientContext()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [myRole, setMyRole] = useState('')
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<Record<string, Record<SectionId, Perm[]>>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !clientId || loadingClientId) return
    const load = async () => {
      setLoading(true)

      // Obtener rol del usuario actual (o admin si es super_admin)
      const { data: me } = await supabase
        .from('client_members')
        .select('role')
        .eq('auth_user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      // Si es super_admin (incluso impersonalizando), darle permisos de admin
      const isSuperAdmin = me?.role === 'super_admin'

      // Para super admin impersonalizando, verificar si hay membresía en el cliente actual
      let effectiveRole = me?.role || 'viewer'
      if (isSuperAdmin || effectiveRole === 'super_admin') {
        effectiveRole = 'admin'
      } else {
        // Si no es super admin, verificar que sea miembro del cliente actual
        const { data: membership } = await supabase
          .from('client_members')
          .select('role')
          .eq('client_id', clientId)
          .eq('auth_user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()

        effectiveRole = membership?.role || 'viewer'
      }

      setMyRole(effectiveRole)

      // Usar función RPC para obtener miembros con emails
      const { data: allMembers } = await supabase.rpc('get_client_members_with_email', {
        p_client_id: clientId
      })

      const memberList = (allMembers as Member[]) || []
      setMembers(memberList)

      // Cargar permisos de cada miembro
      const memberIds = memberList.map(m => m.id)
      if (memberIds.length > 0) {
        const { data: permsData } = await supabase
          .from('member_permissions')
          .select('member_id, section, permissions')
          .in('member_id', memberIds)

        const permsMap: Record<string, Record<SectionId, Perm[]>> = {}
        for (const member of memberList) {
          permsMap[member.id] = {} as Record<SectionId, Perm[]>
          for (const section of SECTIONS) {
            const found = permsData?.find(p => p.member_id === member.id && p.section === section.id)
            permsMap[member.id][section.id] = (found?.permissions as Perm[]) || []
          }
        }
        setPermissions(permsMap)
      }
      setLoading(false)
    }
    load()
  }, [user, clientId, loadingClientId])

  const isAdmin = myRole === 'admin'

  const togglePerm = (memberId: string, sectionId: SectionId, perm: Perm) => {
    setPermissions(prev => {
      const current = prev[memberId]?.[sectionId] || []
      const next = current.includes(perm)
        ? current.filter(p => p !== perm)
        : [...current, perm]
      return { ...prev, [memberId]: { ...prev[memberId], [sectionId]: next } }
    })
  }

  const savePermissions = async (memberId: string) => {
    setSaving(memberId)
    const memberPerms = permissions[memberId] || {}
    const upserts = SECTIONS.map(s => ({
      member_id: memberId,
      section: s.id,
      permissions: memberPerms[s.id] || [],
    }))

    await supabase
      .from('member_permissions')
      .upsert(upserts, { onConflict: 'member_id,section' })

    setSaving(null)
    setSaved(memberId)
    setTimeout(() => setSaved(null), 2000)
  }

  const permLabels: Record<Perm, string> = {
    view: 'Ver', edit: 'Editar', create: 'Crear', delete: 'Eliminar'
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <div className="h-5 w-24 bg-secondary rounded animate-pulse" />
          </div>
          <div className="divide-y divide-border">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-secondary animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-secondary rounded animate-pulse" />
                  <div className="h-3 w-32 bg-secondary/50 rounded animate-pulse" />
                </div>
                <div className="h-6 w-20 bg-secondary rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <Shield className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Solo el administrador puede gestionar los permisos del equipo.</p>
      </div>
    )
  }

  const nonAdminMembers = members.filter(m => m.role !== 'admin' && m.status !== 'pending')

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <p className="text-sm text-muted-foreground">
        Configura qué secciones puede acceder cada miembro y qué acciones puede realizar.
        Los administradores siempre tienen acceso completo.
      </p>

      {nonAdminMembers.length === 0 && (
        <div className="border-2 border-dashed border-border rounded-2xl p-10 flex flex-col items-center gap-3 text-center">
          <Users className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No hay miembros no-admin para configurar aún. Invita a alguien desde la pestaña Equipo.</p>
        </div>
      )}

      {nonAdminMembers.map(member => {
        const isExpanded = expandedMember === member.id
        const memberPerms = permissions[member.id] || {}
        return (
          <div key={member.id} className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Member header */}
            <button
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-secondary/30 transition-colors"
              onClick={() => setExpandedMember(isExpanded ? null : member.id)}
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                {(member.full_name || member.email || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{member.full_name || member.email || `ID: ${member.id.substring(0, 8)}`}</p>
                <p className="text-xs text-muted-foreground truncate">{member.email || member.role}</p>
              </div>
              {saved === member.id && <span className="text-xs text-primary flex items-center gap-1"><Check className="h-3 w-3" />Guardado</span>}
              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {/* Permissions grid */}
            {isExpanded && (
              <div className="border-t border-border">
                {/* Header row */}
                <div className="grid grid-cols-12 px-5 py-2 bg-secondary/30 text-xs font-medium text-muted-foreground">
                  <span className="col-span-4">Sección</span>
                  {ALL_PERMS.map(p => (
                    <span key={p} className="col-span-2 text-center">{permLabels[p]}</span>
                  ))}
                </div>

                {SECTIONS.map(section => {
                  const sectionPerms = memberPerms[section.id] || []
                  return (
                    <div key={section.id} className="grid grid-cols-12 px-5 py-2.5 border-t border-border/50 items-center hover:bg-secondary/20 transition-colors">
                      <span className="col-span-4 text-sm text-foreground">{section.label}</span>
                      {ALL_PERMS.map(perm => (
                        <div key={perm} className="col-span-2 flex justify-center">
                          <button
                            onClick={() => togglePerm(member.id, section.id, perm)}
                            className={cn(
                              'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                              sectionPerms.includes(perm)
                                ? 'bg-primary border-primary'
                                : 'border-border hover:border-primary/50'
                            )}
                          >
                            {sectionPerms.includes(perm) && <Check className="h-3 w-3 text-primary-foreground" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                })}

                <div className="px-5 py-3 border-t border-border flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => savePermissions(member.id)}
                    disabled={saving === member.id}
                    className="gap-2"
                  >
                    {saving === member.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Guardar permisos
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
