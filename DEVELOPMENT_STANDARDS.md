# 📘 Development Standards - ConversAI Builder

## 🎭 Impersonalización de Clientes (Super Admin)

### ⚠️ REGLA CRÍTICA: Siempre usar `useClientContext()`

**NUNCA** obtener el `client_id` directamente del usuario autenticado. **SIEMPRE** usar el hook `useClientContext()`.

### ❌ INCORRECTO (NO HACER):

```typescript
// ❌ MAL - Esto NO funciona con impersonalización
const { user } = useAuth()

const { data: membership } = await supabase
  .from('client_members')
  .select('client_id')
  .eq('auth_user_id', user.id)  // ← Esto usa el super admin ID!
  .single()

const clientId = membership.client_id
```

**Problema**: Cuando el super admin impersonaliza, `user.id` sigue siendo el ID del super admin, no del cliente impersonalizado.

### ✅ CORRECTO (HACER):

```typescript
// ✅ BIEN - Esto funciona con impersonalización
import { useClientContext } from '@/hooks/use-client-context'

const { clientId, isLoading: loadingClientId } = useClientContext()

useEffect(() => {
  if (!clientId || loadingClientId) return

  // Ahora clientId es el correcto (impersonalizado o real)
  fetchData(clientId)
}, [clientId, loadingClientId])
```

---

## 📋 Componentes que DEBEN usar `useClientContext()`

Todos los componentes del dashboard que obtienen datos filtrados por cliente:

### ✅ Componentes Actualizados (Correcto):

1. **AgentsSection.tsx** - Lista de agentes
2. **WAInteractionsSection.tsx** - Conversaciones de WhatsApp
3. **TokensSection.tsx** - Tokens y órdenes de servicio
4. **AccountSection.tsx** - Gestión de equipo
5. **OverviewSection.tsx** - Panel general y métricas
6. **AgentUsageSection.tsx** - Uso de agentes y estadísticas
7. **WAConnectionsSection.tsx** - Conexiones de WhatsApp

### 🔍 Cómo Verificar si un Componente Usa el Hook Correctamente:

```bash
# Buscar componentes que NO usan useClientContext
grep -l "client_members.*auth_user_id.*user.id" src/components/dashboard/*.tsx

# Si devuelve resultados, esos componentes necesitan ser corregidos
```

---

## 🧪 Testing de Impersonalización

### Checklist Antes de Commit:

1. ✅ Todos los componentes del dashboard usan `useClientContext()`
2. ✅ No hay queries directas a `client_members` con `auth.uid()`
3. ✅ Probar manualmente la impersonalización en TODAS las secciones

---

## 📝 Historia de Correcciones

### 2026-02-21: Corrección Masiva de Impersonalización

**Problema**: Solo 4 de 8 componentes del dashboard usaban `useClientContext()`, causando que la impersonalización mostrara datos incorrectos (tokens, métricas, conexiones).

**Componentes corregidos**:
- ✅ OverviewSection.tsx
- ✅ AgentUsageSection.tsx
- ✅ WAConnectionsSection.tsx

**Migraciones creadas**:
- `20260221000006_create_is_super_admin_function.sql`
- `20260221000007_fix_get_client_members_for_impersonation.sql`

- v1
