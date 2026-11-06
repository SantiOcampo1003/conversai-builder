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

### 2026-03-06: Estándar de RLS Policies con Super Admin

**Problema**: Recursión infinita en políticas RLS cuando `is_super_admin()` consultaba `client_members`, pero las políticas de `client_members` llamaban a `is_super_admin()`.

**Solución**:
1. `is_super_admin()` lee desde JWT metadata (`user_metadata.is_super_admin`)
2. Trigger sincroniza el rol a metadata automáticamente
3. Todas las políticas RLS usan el patrón estándar

**Migraciones creadas**:
- `20260306201228_fix_super_admin_recursion.sql` - Función `is_super_admin()` desde JWT
- `20260306202913_fix_client_members_policies_recursion.sql` - Políticas de `client_members`
- `20260306203415_add_super_admin_to_all_team_tables.sql` - Políticas de `member_permissions`

---

## 🔒 Estándar de Row Level Security (RLS) Policies

### ⚙️ Arquitectura de `is_super_admin()`

**NUNCA** consultar tablas dentro de `is_super_admin()` para evitar recursión infinita.

#### ✅ Implementación Correcta:

```sql
-- Función que lee desde JWT (NO consulta client_members)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'is_super_admin')::boolean,
    false
  );
$$;
```

#### 🔄 Sincronización Automática a Metadata:

```sql
-- Trigger que mantiene is_super_admin sincronizado en user metadata
CREATE OR REPLACE FUNCTION public.sync_super_admin_to_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super boolean;
BEGIN
  v_is_super := (NEW.role = 'super_admin' AND NEW.status = 'active');

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) ||
      jsonb_build_object('is_super_admin', v_is_super)
  WHERE id = NEW.auth_user_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_super_admin_metadata_on_insert
  AFTER INSERT ON public.client_members
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_super_admin_to_metadata();

CREATE TRIGGER sync_super_admin_metadata_on_update
  AFTER UPDATE ON public.client_members
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role OR OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sync_super_admin_to_metadata();
```

---

### 📋 Patrón Estándar de Políticas RLS

**TODAS** las tablas que requieren acceso por cliente deben seguir este patrón:

#### Template para Políticas:

```sql
-- ══════════════════════════════════════════════════════════
-- TABLA: nombre_tabla
-- ══════════════════════════════════════════════════════════

-- SELECT: super_admin O miembros del cliente
CREATE POLICY "view_nombre_tabla"
  ON nombre_tabla FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR client_id IN (SELECT public.get_my_client_ids())
  );

-- INSERT: super_admin O miembros del cliente
CREATE POLICY "insert_nombre_tabla"
  ON nombre_tabla FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR client_id IN (SELECT public.get_my_client_ids())
  );

-- UPDATE: super_admin O miembros del cliente
CREATE POLICY "update_nombre_tabla"
  ON nombre_tabla FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR client_id IN (SELECT public.get_my_client_ids())
  );

-- DELETE: super_admin O miembros del cliente
CREATE POLICY "delete_nombre_tabla"
  ON nombre_tabla FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR client_id IN (SELECT public.get_my_client_ids())
  );
```

#### ⚠️ Reglas Críticas:

1. **SIEMPRE** incluir `public.is_super_admin()` como primera condición en TODAS las políticas
2. **NUNCA** usar `EXISTS (SELECT FROM client_members)` dentro de políticas - causa recursión
3. **SIEMPRE** usar `get_my_client_ids()` (función SECURITY DEFINER) para obtener clientes del usuario
4. **Mantener orden**: Super admin primero, luego condiciones normales

#### 🔍 Ejemplo Real - member_permissions:

```sql
-- SELECT: super_admin O miembros del cliente O el propio miembro
CREATE POLICY "view permissions"
  ON member_permissions FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR member_id IN (
      SELECT cm.id FROM client_members cm
      WHERE cm.client_id IN (SELECT public.get_my_client_ids())
    )
    OR member_id IN (
      SELECT id FROM client_members WHERE auth_user_id = auth.uid()
    )
  );

-- INSERT: super_admin O miembros del cliente
CREATE POLICY "insert permissions"
  ON member_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR member_id IN (
      SELECT cm.id FROM client_members cm
      WHERE cm.client_id IN (SELECT public.get_my_client_ids())
    )
  );
```

---

### ✅ Checklist para Nuevas Tablas con RLS:

1. ☐ Crear políticas SELECT, INSERT, UPDATE, DELETE
2. ☐ Incluir `public.is_super_admin()` como primera condición
3. ☐ Usar `get_my_client_ids()` para filtrar por cliente
4. ☐ NUNCA consultar `client_members` directamente en políticas
5. ☐ Probar con super admin impersonalizando
6. ☐ Probar con usuario admin normal
7. ☐ Probar con usuario viewer/member

---

### 🚫 Anti-Patrones (NO HACER):

#### ❌ Recursión Infinita:

```sql
-- ❌ MAL - Causa recursión infinita
CREATE POLICY "bad_policy"
  ON client_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_members  -- ← Consulta la misma tabla!
      WHERE role = 'super_admin'
    )
  );
```

#### ❌ Sin Soporte de Super Admin:

```sql
-- ❌ MAL - Super admin no puede acceder
CREATE POLICY "incomplete_policy"
  ON agents FOR SELECT
  USING (
    client_id IN (SELECT get_my_client_ids())
    -- ← Falta OR public.is_super_admin()
  );
```

#### ❌ Consulta Directa a client_members:

```sql
-- ❌ MAL - Puede causar recursión
CREATE POLICY "bad_check"
  ON agents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_members
      WHERE auth_user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- ✅ BIEN - Usar is_super_admin() o get_my_client_ids()
CREATE POLICY "good_check"
  ON agents FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR client_id IN (SELECT public.get_my_client_ids())
  );
```

---

## 🔧 Funciones Helper Disponibles

### `public.is_super_admin()`
- **Propósito**: Verificar si el usuario autenticado es super admin
- **Retorna**: `boolean`
- **Uso**: Incluir en TODAS las políticas RLS
- **Seguro**: ✅ No causa recursión (lee desde JWT)

### `public.get_my_client_ids()`
- **Propósito**: Obtener IDs de clientes donde el usuario es miembro activo
- **Retorna**: `TABLE(client_id uuid)`
- **Uso**: Filtrar datos por cliente
- **Seguro**: ✅ Usa SECURITY DEFINER

### `public.is_admin_of_client(p_client_id uuid)`
- **Propósito**: Verificar si el usuario es admin de un cliente específico
- **Retorna**: `boolean`
- **Uso**: Validaciones específicas de admin
- **Seguro**: ✅ Usa SECURITY DEFINER

---

## 📊 Tablas con RLS Implementado Correctamente:

- ✅ `clients` - Clientes
- ✅ `client_members` - Membresías de equipo
- ✅ `member_permissions` - Permisos granulares
- ✅ `agents` - Agentes de IA
- ✅ `chat_history` - Conversaciones
- ✅ `token_balances` - Saldo de tokens
- ✅ `token_transactions` - Transacciones de tokens
- ✅ `whatsapp_lines` - Líneas de WhatsApp (agregada 2026-02-22)

---

- v2

---

## ⏰ Tareas Programadas (Crons)

### ⚙️ Regla: ¿Dónde va el cron?

| La tarea… | Va en | Ejemplo |
|---|---|---|
| Solo lee/escribe la base de datos | **`pg_cron`** en una migración de Supabase | `cancel_expired_token_payments()` cada hora (`20260222000002_payment_retry_system.sql`) |
| Llama a una API externa (Meta, Evolution, OpenAI…) o usa secretos del backend | **`@nestjs/schedule`** en el backend NestJS | Renovación diaria de tokens de clientes de Meta (`MetaTokenRenewalService`) |

**Por qué:** los secretos (`WHATSAPP_TOKEN_ENCRYPTION_KEY`, API keys) viven solo en el backend y **nunca** se guardan en la base; y la lógica de integraciones (clientes HTTP, cifrado, logs) ya está en el backend. No usamos `pg_net` para que Supabase "despierte" al backend.

### ✅ Checklist para un cron nuevo

- **pg_cron:** función SQL `SECURITY DEFINER` con `SET search_path = public`; programarla en la migración con `cron.schedule('<nombre-unico>', '<expr>', $sql$SELECT ...$sql$)`; idempotente (re-ejecutarla no cambia nada si no hay trabajo).
- **Backend:** método `@Cron('<expr>', { timeZone: 'America/Bogota' })` que solo delega en un método público testeable (p. ej. `renewDueTokens(now)`).
- **Idempotente y seguro con réplicas:** actualizar con condición sobre el valor leído (`.eq('columna', valorAnterior)`) para que dos ejecuciones simultáneas no se pisen.
- **Un fallo no detiene el lote:** capturar el error por ítem, registrarlo (sin tokens en logs) y seguir con los demás.
- **Tolerante a corridas perdidas:** el backend puede estar redesplegando a la hora del cron; diseñar con margen (ej. renovar desde 15 días antes del vencimiento) en lugar de depender de una sola ejecución.
- **Visibilidad:** si el fallo requiere acción del cliente, dejarlo marcado en la base y mostrarlo en el panel.
