// ============================================================
// SISTEMA DE PERMISOS — formato: "seccion:recurso:accion"
// ============================================================
// Wildcards:
//   "*"                      → todos los permisos
//   "agents:*"               → todos los permisos de agents
//   "agents:list"            → solo listar agentes
// ============================================================

export const PERMISSIONS = {
  // ── Agentes ──────────────────────────────────────────────
  AGENTS_LIST:           'agents:list',        // ver listado de agentes
  AGENTS_VIEW:           'agents:view',        // ver detalle de un agente
  AGENTS_CREATE:         'agents:create',      // crear nuevo agente
  AGENTS_EDIT:           'agents:edit',        // editar configuración de agente
  AGENTS_DELETE:         'agents:delete',      // eliminar agente
  AGENTS_ALL:            'agents:*',

  // ── Interacciones WhatsApp ────────────────────────────────
  WA_INTERACTIONS_LIST:   'whatsapp-interactions:list',   // ver listado de conversaciones
  WA_INTERACTIONS_VIEW:   'whatsapp-interactions:view',   // ver conversación específica
  WA_INTERACTIONS_EXPORT: 'whatsapp-interactions:export', // exportar historial
  WA_INTERACTIONS_ALL:    'whatsapp-interactions:*',

  // ── Conexiones WhatsApp ───────────────────────────────────
  WA_CONNECTIONS_LIST:   'whatsapp-connections:list',    // ver conexiones activas
  WA_CONNECTIONS_CREATE: 'whatsapp-connections:create',  // conectar número nuevo
  WA_CONNECTIONS_EDIT:   'whatsapp-connections:edit',    // editar conexión existente
  WA_CONNECTIONS_DELETE: 'whatsapp-connections:delete',  // desconectar número
  WA_CONNECTIONS_ALL:    'whatsapp-connections:*',

  // ── Uso de agentes ────────────────────────────────────────
  USAGE_VIEW:   'agents-usage:view',    // ver estadísticas y métricas
  USAGE_EXPORT: 'agents-usage:export',  // exportar reporte de uso
  USAGE_ALL:    'agents-usage:*',

  // ── Tokens (saldo y recargas) ─────────────────────────────
  TOKENS_VIEW:     'tokens:view',      // ver saldo disponible
  TOKENS_HISTORY:  'tokens:history',   // ver historial de transacciones
  TOKENS_RECHARGE: 'tokens:recharge',  // realizar recargas
  TOKENS_ALL:      'tokens:*',

  // ── Cuenta y equipo ───────────────────────────────────────
  ACCOUNT_VIEW:           'account:view',            // ver configuración de cuenta
  ACCOUNT_EDIT:           'account:edit',            // editar datos de cuenta
  ACCOUNT_MEMBERS_LIST:   'account:members:list',    // ver miembros del equipo
  ACCOUNT_MEMBERS_INVITE: 'account:members:invite',  // invitar nuevos miembros
  ACCOUNT_MEMBERS_EDIT:   'account:members:edit',    // cambiar rol de miembro
  ACCOUNT_MEMBERS_REMOVE: 'account:members:remove',  // eliminar miembro
  ACCOUNT_ALL:            'account:*',
} as const

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]

// ============================================================
// PERMISOS POR ROL BASE
// ============================================================
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    '*', // acceso total
  ],

  // Administrador de agentes: acceso completo excepto recargar tokens
  'agent-administrator': [
    PERMISSIONS.AGENTS_ALL,
    PERMISSIONS.WA_INTERACTIONS_ALL,
    PERMISSIONS.WA_CONNECTIONS_ALL,
    PERMISSIONS.USAGE_ALL,
    PERMISSIONS.TOKENS_VIEW,
    PERMISSIONS.TOKENS_HISTORY,
    // Sin TOKENS_RECHARGE
    PERMISSIONS.ACCOUNT_ALL,
  ],

  collaborator: [
    // Agentes — puede ver y editar, no eliminar ni crear
    PERMISSIONS.AGENTS_LIST,
    PERMISSIONS.AGENTS_VIEW,
    PERMISSIONS.AGENTS_EDIT,

    // Interacciones — lectura completa
    PERMISSIONS.WA_INTERACTIONS_LIST,
    PERMISSIONS.WA_INTERACTIONS_VIEW,
    PERMISSIONS.WA_INTERACTIONS_EXPORT,

    // Conexiones — solo ver
    PERMISSIONS.WA_CONNECTIONS_LIST,

    // Uso — solo ver
    PERMISSIONS.USAGE_VIEW,

    // Tokens — solo ver saldo e historial
    PERMISSIONS.TOKENS_VIEW,
    PERMISSIONS.TOKENS_HISTORY,

    // Cuenta — solo ver, no gestión de miembros
    PERMISSIONS.ACCOUNT_VIEW,
  ],

  viewer: [
    // Solo lectura en todo
    PERMISSIONS.AGENTS_LIST,
    PERMISSIONS.AGENTS_VIEW,
    PERMISSIONS.WA_INTERACTIONS_LIST,
    PERMISSIONS.WA_INTERACTIONS_VIEW,
    PERMISSIONS.USAGE_VIEW,
    PERMISSIONS.TOKENS_VIEW,
    PERMISSIONS.ACCOUNT_VIEW,
  ],
}

// ============================================================
// HELPER: verificar si un usuario tiene un permiso
// ============================================================
// member.permissions: string[] | null  → si null, usa permisos del rol
// member.role: 'admin' | 'collaborator' | 'viewer'

export function hasPermission(
  role: string,
  permission: string,
  permissionsOverride?: string[] | null
): boolean {
  const perms = permissionsOverride ?? ROLE_PERMISSIONS[role] ?? []

  // Wildcard total
  if (perms.includes('*')) return true

  // Permiso exacto
  if (perms.includes(permission)) return true

  // Wildcard de sección: "agents:*" cubre "agents:list", "agents:edit", etc.
  const [section] = permission.split(':')
  if (perms.includes(`${section}:*`)) return true

  // Wildcard de sección con sub-recurso: "account:members:*" cubre "account:members:invite"
  const parts = permission.split(':')
  if (parts.length === 3 && perms.includes(`${parts[0]}:${parts[1]}:*`)) return true

  return false
}

// Hook-friendly: genera un objeto de permisos booleanos para el member actual
export function buildPermissionMap(role: string, permissionsOverride?: string[] | null) {
  const check = (p: string) => hasPermission(role, p, permissionsOverride)
  return {
    agents:             { list: check(PERMISSIONS.AGENTS_LIST), view: check(PERMISSIONS.AGENTS_VIEW), create: check(PERMISSIONS.AGENTS_CREATE), edit: check(PERMISSIONS.AGENTS_EDIT), delete: check(PERMISSIONS.AGENTS_DELETE) },
    waInteractions:     { list: check(PERMISSIONS.WA_INTERACTIONS_LIST), view: check(PERMISSIONS.WA_INTERACTIONS_VIEW), export: check(PERMISSIONS.WA_INTERACTIONS_EXPORT) },
    waConnections:      { list: check(PERMISSIONS.WA_CONNECTIONS_LIST), create: check(PERMISSIONS.WA_CONNECTIONS_CREATE), edit: check(PERMISSIONS.WA_CONNECTIONS_EDIT), delete: check(PERMISSIONS.WA_CONNECTIONS_DELETE) },
    usage:              { view: check(PERMISSIONS.USAGE_VIEW), export: check(PERMISSIONS.USAGE_EXPORT) },
    tokens:             { view: check(PERMISSIONS.TOKENS_VIEW), history: check(PERMISSIONS.TOKENS_HISTORY), recharge: check(PERMISSIONS.TOKENS_RECHARGE) },
    account:            { view: check(PERMISSIONS.ACCOUNT_VIEW), edit: check(PERMISSIONS.ACCOUNT_EDIT), members: { list: check(PERMISSIONS.ACCOUNT_MEMBERS_LIST), invite: check(PERMISSIONS.ACCOUNT_MEMBERS_INVITE), edit: check(PERMISSIONS.ACCOUNT_MEMBERS_EDIT), remove: check(PERMISSIONS.ACCOUNT_MEMBERS_REMOVE) } },
  }
}
