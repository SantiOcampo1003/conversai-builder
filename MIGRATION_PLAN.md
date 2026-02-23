# 📊 PLAN DE MIGRACIÓN: Producción → Nueva Estructura

**Fecha**: 2026-02-22
**Objetivo**: Migrar estructura vieja en producción a nueva estructura local preservando datos de `teia_invest_2026`

---

## 🔍 ANÁLISIS: Uso de Tabla `leads`

### ❌ **NO se usa en el código nuevo del dashboard:**
- ✅ Verificado: CERO referencias en componentes React (src/)
- ✅ Verificado: NO se usa en AgentsSection, OverviewSection, TokensSection, etc.
- ✅ Verificado: NO se usa en FlowFormSection (wizard de creación)

### ✅ **SÍ existe en el esquema:**
- Definida en `20260214151533_initial_schema.sql`
- Tabla funcional de CRM para contactos/prospectos
- Relación FK: `leads.agent_id` → `agents.agent_id`
- Campos: id, agent_id, name, phone, email, address, notes, status, source
- Solo usada en `seed.sql` para datos de prueba

### 🎯 **Conclusión:**
La tabla `leads` es **legacy** o funcionalidad futura sin implementar. Está en el esquema pero no tiene UI en el nuevo dashboard.

**Recomendación**:
- **CONSERVAR** la tabla `leads` en producción (tiene datos históricos de teia_invest_2026)
- **NO eliminar** porque puede tener datos valiosos
- **Opción futura**: Implementar UI de CRM para gestionar leads, o migrar datos si se necesitan en otra estructura

---

## 🏗️ Estado Actual

### Esquema REMOTO (Producción - Supabase Cloud)

**Tablas existentes:**
- ✅ `agents` - Con `client_id` (uuid, puede ser NULL)
- ✅ `clients` - Estructura básica (id, name, email, phone, company_name, auth_user_id)
- ✅ `chat_history` - Historial de conversaciones
- ✅ `leads` - **Contactos/prospectos capturados** (CRM del agente) - CONSERVAR
- ✅ `lead_analyses` - Análisis de leads
- ✅ `token_balances` - Balance de tokens
- ✅ `token_transactions` - Transacciones de tokens
- ✅ `token_packages` - Paquetes disponibles
- ✅ `control_points` - Puntos de control geográfico
- ❌ `client_members` - NO EXISTE
- ❌ `member_permissions` - NO EXISTE
- ❌ `service_orders` - NO EXISTE
- ❌ `professional_services` - NO EXISTE

**Datos del agente `teia_invest_2026`:**
- ✅ ID: 1
- ✅ Agent ID: `teia_invest_2026`
- ✅ Email: `teia@invest.com`
- ✅ Business: Teia Invest - Educación Financiera
- ✅ Productos: 3 cursos digitales (USD 150-270)
- ✅ Payment Gateway: Hotmart (3 payment links configurados)
- ✅ Configuración completa: FAQs, personalidad, custom_instructions
- ✅ Chat History: ~100+ mensajes en conversaciones reales
- ⚠️ client_id: Probablemente NULL (verificar en Fase 1)

### Esquema LOCAL (Nueva Estructura)

**Tablas nuevas que se agregarán:**
- ➕ `client_members` - Sistema de membresías multi-usuario
- ➕ `member_permissions` - Permisos granulares por sección
- ➕ `service_orders` - Órdenes de servicios profesionales
- ➕ `professional_services` - Catálogo de servicios (Setup, Integración, Consultoría)
- ➕ Funciones RPC: `get_client_members_with_email`, `is_super_admin`, `update_token_balance`, etc.
- ➕ Triggers: `auto_create_client_on_signup`
- ➕ Enum `team_roles`: (admin, agent-manager, billing, viewer, super_admin)

---

## 🎯 Objetivos de Migración

### 1. PRESERVAR (100% sin pérdida)
- ✅ Configuración completa del agente `teia_invest_2026`
- ✅ Todo el historial de chat (chat_history)
- ✅ Todos los leads capturados (tabla `leads`)
- ✅ Relación con cliente (crear/asignar client_id)
- ✅ Token balances y transactions
- ✅ Todas las demás tablas existentes

### 2. AGREGAR (Nuevas funcionalidades)
- ✅ Sistema de membresías (client_members)
- ✅ Permisos granulares (member_permissions)
- ✅ Servicios profesionales (service_orders, professional_services)
- ✅ Mejoras en RLS policies con `is_super_admin()`
- ✅ Sistema de impersonalización
- ✅ Payment link management

### 3. MANTENER (Compatibilidad)
- ✅ Tabla `leads` se CONSERVA (no se elimina)
- ✅ Estructura existente compatible
- ✅ Sin breaking changes en datos existentes

---

## 📋 PLAN DE MIGRACIÓN PASO A PASO

### ⚠️ IMPORTANTE: NO EJECUTAR SIN CONFIRMACIÓN

Este es solo el PLAN. No ejecutar nada hasta revisión y aprobación.

---

### **Fase 1: Preparación y Backup** (SIN RIESGO - SOLO LECTURA)

#### 1.1 Backup completo de producción
```bash
# Backup completo con timestamp
npx supabase db dump --linked \
  --file=backups/backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql

# Backup solo de datos
npx supabase db dump --linked --data-only \
  --file=backups/data_only_$(date +%Y%m%d_%H%M%S).sql
```

#### 1.2 Backup específico de teia_invest_2026
```bash
# Guardar dump completo para extracción manual si es necesario
npx supabase db dump --linked --data-only \
  --file=backups/teia_invest_2026_backup.sql
```

#### 1.3 Verificar datos existentes de teia_invest_2026
```sql
-- Ejecutar en Supabase Dashboard → SQL Editor
-- NO MODIFICA NADA, solo consulta

-- Información del agente
SELECT
  id,
  agent_id,
  email,
  business_name,
  client_id,  -- IMPORTANTE: Verificar si es NULL
  created_at
FROM agents
WHERE agent_id = 'teia_invest_2026';

-- Contar chat history
SELECT
  'chat_history' as table_name,
  count(*) as records
FROM chat_history
WHERE agent_id = 'teia_invest_2026'

UNION ALL

-- Contar leads
SELECT
  'leads' as table_name,
  count(*) as records
FROM leads
WHERE agent_id = 'teia_invest_2026'

UNION ALL

-- Verificar cliente si existe client_id
SELECT
  'client (if exists)' as table_name,
  count(*) as records
FROM clients c
WHERE EXISTS (
  SELECT 1 FROM agents a
  WHERE a.client_id = c.id
  AND a.agent_id = 'teia_invest_2026'
);
```

**Documentar resultados antes de continuar:**
- [ ] client_id actual: ________________
- [ ] Total chat_history: ______________
- [ ] Total leads: ___________________

---

### **Fase 2: Crear/Verificar Cliente para Teia** (PRIMERA MODIFICACIÓN)

#### 2.1 Verificar si ya existe cliente para teia_invest_2026

```sql
-- Consulta segura (solo lectura)
SELECT
  a.agent_id,
  a.client_id,
  c.id as client_table_id,
  c.company_name,
  c.email as client_email
FROM agents a
LEFT JOIN clients c ON a.client_id = c.id
WHERE a.agent_id = 'teia_invest_2026';
```

#### 2.2a Si client_id es NULL → Crear nuevo cliente

```sql
-- PRIMERA ESCRITURA - Crear cliente
INSERT INTO clients (
  id,
  name,
  email,
  phone,
  company_name,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),  -- Se genera automáticamente
  'Teia',
  'teia@invest.com',
  NULL,  -- Agregar si se tiene el teléfono
  'Teia Invest',
  NOW(),
  NOW()
)
RETURNING id, company_name, email;
```

**📝 Documentar UUID generado**: _______________________

#### 2.2b Actualizar agent con client_id

```sql
-- Reemplazar <UUID_CLIENTE> con el UUID documentado arriba
UPDATE agents
SET client_id = '<UUID_CLIENTE>'
WHERE agent_id = 'teia_invest_2026';

-- Verificar actualización
SELECT agent_id, business_name, client_id
FROM agents
WHERE agent_id = 'teia_invest_2026';
```

---

### **Fase 3: Aplicar Migraciones** (CAMBIOS ESTRUCTURALES)

#### 3.1 Revisar diff de migraciones locales vs remoto

```bash
# Ver qué cambios se aplicarían (solo preview)
npx supabase db diff --linked

# Listar migraciones locales
ls -la supabase/migrations/ | grep -E "202602"
```

#### 3.2 Revisar migraciones críticas a aplicar

**Orden de aplicación** (automático con `db push`):
1. ✅ `20260218000000_client_members_and_rls.sql` - Sistema membresías
2. ✅ `20260219000000_team_roles_and_permissions.sql` - Roles y permisos
3. ✅ `20260219000100_member_emails_function.sql` - Función emails
4. ✅ `20260219000200_whatsapp_lines.sql` - WhatsApp lines
5. ✅ `20260219000300_user_feedback.sql` - User feedback
6. ✅ `20260219000400_auto_create_client_on_signup.sql` - Trigger signup
7. ✅ `20260219000500_invite_system.sql` - Sistema invitaciones
8. ✅ `20260219000600_get_invite_email_function.sql` - Función invite email
9. ✅ `20260219000700_accept_invite_function.sql` - Función aceptar invite
10. ✅ `20260219000800_fix_billing_role_permissions.sql` - Fix permisos billing
11. ✅ `20260220171520_fix_auto_create_client_trigger.sql` - Fix trigger
12. ✅ `20260221000000_professional_services_system.sql` - Servicios profesionales
13. ✅ `20260221000001_services_seed_data.sql` - Seed servicios
14. ✅ `20260221000002_add_super_admin_role.sql` - Rol super_admin
15. ✅ `20260221000003_fix_clients_rls_for_super_admin.sql` - RLS super admin
16. ✅ `20260221000004_add_update_token_balance_function.sql` - Función tokens
17. ✅ `20260221000005_super_admin_full_access_rls.sql` - RLS completo
18. ✅ `20260221000006_create_is_super_admin_function.sql` - Función is_super_admin
19. ✅ `20260221000007_fix_get_client_members_for_impersonation.sql` - RPC members
20. ✅ `20260221000008_fix_ambiguous_column_reference.sql` - Fix RPC
21. ✅ `20260221000009_add_payment_link_management.sql` - Payment links

#### 3.3 Aplicar migraciones (CRÍTICO)

```bash
# ESTE ES EL COMANDO QUE MODIFICA LA BASE DE DATOS EN PRODUCCIÓN
# Revisar diff primero
npx supabase db push --linked

# Si pide confirmación, revisar cambios antes de aceptar
```

⚠️ **CHECKPOINT**: Verificar que no hay errores antes de continuar

---

### **Fase 4: Crear Membresía para Usuario Teia** (CONFIGURACIÓN INICIAL)

#### 4.1 Verificar si usuario de auth existe para teia@invest.com

```sql
-- Consultar en auth.users (requiere permisos de service_role)
-- O verificar en Supabase Dashboard → Authentication → Users
SELECT id, email
FROM auth.users
WHERE email = 'teia@invest.com';
```

#### 4.2a Si NO existe usuario de auth → Crear invitación

```sql
-- Insertar membresía pendiente con invite
INSERT INTO client_members (
  client_id,
  auth_user_id,
  role,
  status,
  invite_email,
  invite_token,
  invited_at,
  created_at
)
SELECT
  id as client_id,
  '00000000-0000-0000-0000-000000000000'::uuid as auth_user_id,  -- Placeholder
  'admin' as role,
  'pending' as status,
  'teia@invest.com' as invite_email,
  gen_random_uuid() as invite_token,
  NOW() as invited_at,
  NOW() as created_at
FROM clients
WHERE email = 'teia@invest.com'
RETURNING id, invite_token;
```

**📝 Enviar email de invitación manual** con token generado

#### 4.2b Si SÍ existe usuario de auth → Crear membresía activa

```sql
-- Insertar membresía activa
INSERT INTO client_members (
  client_id,
  auth_user_id,
  role,
  status,
  created_at
)
SELECT
  c.id as client_id,
  u.id as auth_user_id,
  'admin' as role,
  'active' as status,
  NOW() as created_at
FROM clients c
CROSS JOIN auth.users u
WHERE c.email = 'teia@invest.com'
AND u.email = 'teia@invest.com'
RETURNING id, client_id, auth_user_id, role;
```

#### 4.3 Crear permisos default (automático con trigger si existe)

```sql
-- Verificar que se crearon permisos
SELECT
  cm.id as member_id,
  cm.role,
  mp.section,
  mp.permissions
FROM client_members cm
LEFT JOIN member_permissions mp ON mp.member_id = cm.id
JOIN clients c ON c.id = cm.client_id
WHERE c.email = 'teia@invest.com';
```

---

### **Fase 5: Verificación Post-Migración** (CRÍTICO - NO OMITIR)

#### 5.1 Verificar integridad de datos de teia_invest_2026

```sql
-- ✅ Verificar agente preservado
SELECT * FROM agents WHERE agent_id = 'teia_invest_2026';

-- ✅ Verificar chat history preservado (debe coincidir con Fase 1)
SELECT count(*) as total_messages
FROM chat_history
WHERE agent_id = 'teia_invest_2026';

-- ✅ Verificar leads preservados (debe coincidir con Fase 1)
SELECT count(*) as total_leads
FROM leads
WHERE agent_id = 'teia_invest_2026';

-- ✅ Verificar cliente asignado
SELECT
  a.agent_id,
  a.business_name,
  a.client_id,
  c.company_name,
  c.email as client_email
FROM agents a
JOIN clients c ON a.client_id = c.id
WHERE a.agent_id = 'teia_invest_2026';

-- ✅ Verificar membresía creada
SELECT
  cm.id,
  cm.role,
  cm.status,
  c.company_name,
  c.email
FROM client_members cm
JOIN clients c ON cm.client_id = c.id
WHERE c.email = 'teia@invest.com';

-- ✅ Verificar permisos (si role != admin/super_admin)
SELECT
  mp.section,
  mp.permissions,
  cm.role
FROM member_permissions mp
JOIN client_members cm ON mp.member_id = cm.id
JOIN clients c ON cm.client_id = c.id
WHERE c.email = 'teia@invest.com'
ORDER BY mp.section;
```

#### 5.2 Verificar nuevas tablas creadas

```sql
-- Verificar que todas las tablas nuevas existen
SELECT
  tablename,
  schemaname
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'client_members',
  'member_permissions',
  'service_orders',
  'professional_services',
  'user_feedback'
)
ORDER BY tablename;
```

#### 5.3 Verificar funciones RPC creadas

```sql
-- Verificar funciones críticas
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'is_super_admin',
  'get_client_members_with_email',
  'update_token_balance',
  'cancel_expired_payment_links'
)
ORDER BY routine_name;
```

#### 5.4 Verificar RLS policies

```sql
-- Verificar que las policies incluyen is_super_admin
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('agents', 'clients', 'chat_history', 'leads')
ORDER BY tablename, policyname;
```

---

## 🚨 RIESGOS Y MITIGACIONES

### Riesgo ALTO
| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Pérdida de datos de teia_invest_2026 | Baja | ✅ Backup completo en Fase 1<br>✅ Verificación post-migración obligatoria<br>✅ Plan de rollback |

### Riesgo MEDIO
| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Conflictos de RLS policies | Media | ✅ Nuevas policies incluyen `is_super_admin()`<br>✅ Revisar policies post-migración |
| Relación agents → clients rota | Baja | ✅ Crear cliente ANTES de migraciones con FK<br>✅ Verificar client_id != NULL |
| Fallo en migraciones parciales | Media | ✅ Migraciones atómicas<br>✅ Rollback automático en error |

### Riesgo BAJO
| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Incompatibilidad JSONB | Muy baja | ✅ Estructura JSONB no cambia |
| Downtime durante migración | Baja | ✅ Aplicar en horario de bajo tráfico<br>✅ Migraciones rápidas (~1-2 min) |

---

## ✅ DATOS QUE SE PRESERVAN (100%)

### Tablas Completamente Preservadas
- ✅ `agents` (incluyendo teia_invest_2026 con toda su configuración)
- ✅ `chat_history` (todo el historial de conversaciones)
- ✅ `leads` (todos los contactos capturados - **NO SE ELIMINA**)
- ✅ `clients` (mejorada con nuevas relaciones)
- ✅ `token_balances` (todos los balances)
- ✅ `token_transactions` (todo el histórico)
- ✅ `token_packages` (catálogo de paquetes)
- ✅ `control_points` (puntos geográficos)
- ✅ `lead_analyses` (análisis de leads)

### Tablas Nuevas (Vacías Inicialmente)
- ➕ `client_members` - Se crea entrada para teia@invest.com
- ➕ `member_permissions` - Se crean permisos default
- ➕ `service_orders` - Vacía
- ➕ `professional_services` - Se crean 3 servicios de catálogo
- ➕ `user_feedback` - Vacía

---

## 🎯 RESULTADO ESPERADO

### Agente teia_invest_2026
- ✅ Toda su configuración preservada (products, faqs, personality, etc.)
- ✅ Todo su historial de chat intacto (~100+ mensajes)
- ✅ Todos sus leads preservados
- ✅ Vinculado a cliente "Teia Invest" (client_id asignado)
- ✅ Accesible desde el nuevo dashboard
- ✅ Funcional para seguir conversando

### Sistema Nuevo
- ✅ Sistema de membresías funcionando
- ✅ Permisos granulares configurados (si se necesita team)
- ✅ Servicios profesionales disponibles en catálogo
- ✅ Impersonalización funcional para super admin
- ✅ RLS policies actualizadas con is_super_admin()
- ✅ Payment link management ready

### Compatibilidad
- ✅ Tabla `leads` preservada (funcionalidad futura de CRM)
- ✅ Estructura `clients` mejorada pero compatible
- ✅ Sin breaking changes en datos existentes
- ✅ Todo funcional y sin pérdida de información

---

## 📝 CHECKLIST DE EJECUCIÓN

### Pre-Migración
- [ ] Leer plan completo
- [ ] Entender cada fase
- [ ] Tener acceso a Supabase Dashboard
- [ ] Tener backup de código local
- [ ] Elegir horario de bajo tráfico

### Durante Migración
- [ ] **Fase 1**: Backups completos ✅
- [ ] **Fase 1**: Documentar valores actuales ✅
- [ ] **Fase 2**: Crear/verificar cliente ✅
- [ ] **Fase 2**: Actualizar agent.client_id ✅
- [ ] **Fase 3**: Revisar diff de migraciones ✅
- [ ] **Fase 3**: Aplicar migraciones (db push) ✅
- [ ] **Fase 4**: Crear membresía de Teia ✅
- [ ] **Fase 5**: Verificar TODOS los checkpoints ✅
- [ ] **Fase 6**: Crear usuario super admin en Dashboard ✅
- [ ] **Fase 6**: Vincular membresía super_admin ✅
- [ ] **Fase 6**: Verificar acceso super admin ✅

### Post-Migración
- [ ] Verificar que teia_invest_2026 está accesible
- [ ] Verificar que chat history es correcto
- [ ] Verificar que leads se preservaron
- [ ] Hacer login como teia@invest.com (si se creó usuario)
- [ ] Hacer login como superadmin@easyagents.space
- [ ] Verificar dashboard funciona correctamente
- [ ] Probar impersonalización de super admin
- [ ] Documentar client_id final asignado
- [ ] Documentar UUID de super admin
- [ ] Archivar backups en lugar seguro

---

### **Fase 6: Crear Cuenta de Super Admin** (CONFIGURACIÓN ADMINISTRATIVA)

⚠️ **IMPORTANTE**: Esta fase es opcional pero ALTAMENTE RECOMENDADA para gestionar la plataforma.

#### 6.1 Aplicar migración de cliente super admin

La migración `20260222000000_create_super_admin_account.sql` ya está incluida en el `db push` de Fase 3.

Si no la aplicaste antes, verificar:

```sql
-- Verificar que existe el cliente EasyAgents
SELECT * FROM clients WHERE id = '00000000-0000-0000-0000-000000000000';
```

Si NO existe, aplicar manualmente:

```bash
psql <connection-string> < supabase/migrations/20260222000000_create_super_admin_account.sql
```

#### 6.2 Crear usuario de super admin

**Opción Recomendada**: Usar Supabase Dashboard

1. Ir a **Supabase Dashboard** → **Authentication** → **Users**
2. Click **Add User** → **Create New User**
3. Completar:
   - Email: `superadmin@easyagents.space` (o tu email corporativo)
   - Password: `[CONTRASEÑA SEGURA - NO Test1234!]`
   - Auto Confirm User: ✅ Marcar
4. Click **Create User**
5. **📝 COPIAR UUID** del usuario creado

#### 6.3 Vincular usuario con membresía super_admin

```sql
-- Reemplazar <AUTH_USER_ID> con el UUID copiado del paso anterior
INSERT INTO public.client_members (
  client_id,
  auth_user_id,
  role,
  permissions,
  status,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '<AUTH_USER_ID>',  -- ⬅️ REEMPLAZAR AQUÍ
  'super_admin',
  NULL,
  'active',
  NOW(),
  NOW()
);

-- Verificar creación
SELECT
  cm.role,
  cm.status,
  c.company_name,
  u.email
FROM public.client_members cm
JOIN public.clients c ON cm.client_id = c.id
JOIN auth.users u ON cm.auth_user_id = u.id
WHERE u.email = 'superadmin@easyagents.space';
```

**Resultado esperado**: 1 fila con rol `super_admin` y status `active`

#### 6.4 Verificar acceso super admin

1. Hacer login en la aplicación con `superadmin@easyagents.space`
2. Verificar que aparece sección "Super Admin" en el menú
3. Verificar que muestra 1,000,000 tokens en el header
4. Probar impersonalización en un cliente (si existe Teia Invest)

📚 **Guía completa**: Ver `SUPER_ADMIN_SETUP.md` para instrucciones detalladas.

---

## 🔄 PLAN DE ROLLBACK (Si algo sale mal)

### Si falla en Fase 3 (Migraciones)
```bash
# Las migraciones de Supabase son atómicas
# Si falla, hacer rollback manual

# 1. Restaurar backup
npx supabase db reset --linked

# 2. Restaurar datos desde backup
psql <connection-string> < backups/backup_pre_migration_<timestamp>.sql
```

### Si falla en Fase 4-5 (Post-migración)
```sql
-- Eliminar membresía si se creó mal
DELETE FROM client_members
WHERE client_id IN (
  SELECT id FROM clients WHERE email = 'teia@invest.com'
);

-- Restaurar client_id anterior si se modificó
UPDATE agents
SET client_id = NULL  -- o el valor original documentado
WHERE agent_id = 'teia_invest_2026';
```

---

## 📞 SOPORTE Y CONTACTO

Si surge algún problema durante la migración:
1. ⛔ DETENER inmediatamente
2. 📸 Tomar screenshot del error
3. 📝 Documentar en qué fase ocurrió
4. 🔙 Ejecutar rollback si es necesario
5. 🔍 Revisar logs de Supabase Dashboard

---

## ✅ CONFIRMACIÓN FINAL

**IMPORTANTE**: Este plan NO ejecuta nada automáticamente.

Cada comando SQL y bash debe ser:
1. Revisado individualmente
2. Entendido completamente
3. Ejecutado manualmente
4. Verificado que funcionó correctamente

**No proceder sin aprobación explícita.**

---

**Documento creado**: 2026-02-22
**Última actualización**: 2026-02-22
**Estado**: PENDIENTE DE APROBACIÓN ⏸️
