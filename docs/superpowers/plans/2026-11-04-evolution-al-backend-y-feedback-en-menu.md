# Evolution al backend, estado real de líneas, feedback en el menú, navegación fluida y Node 24 — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el navegador nunca vuelva a tener la llave global de Evolution, que el panel de Conexiones WA muestre el estado real de cada línea según Evolution, y que el botón flotante de feedback pase al menú lateral.

**Architecture:** El backend NestJS (que ya habla con Evolution en `notifications/evolution.client.ts`) gana un módulo `whatsapp-lines` que crea, reconecta, desconecta, borra y sincroniza líneas, validando el JWT de Supabase del usuario. El frontend (React + Vite) deja de llamar a Evolution y llama a esos endpoints. La sincronización ocurre al cargar el panel, al pulsar ↻ y durante el escaneo del QR. El feedback es un cambio aislado de UI en `Dashboard.tsx`.

**Tech Stack:** NestJS 11 + Jest (backend), React 18 + Vite 5 + Tailwind/shadcn (frontend, sin framework de tests), Supabase (Postgres + RLS), Evolution API v2.3.7, n8n.

**Spec:** Este plan + la conversación del 2026-11-04: llave global de Evolution expuesta en `VITE_EVOLUTION_API_KEY` y en `conversai-builder/.env.production` (trackeado en git) y hardcodeada en nodos de n8n; `whatsapp_lines.status` solo se escribe al conectar por QR o al pulsar "Desconectar", así que líneas caídas siguen en "Conectado" (ej. `573219385629`, caída desde 2026-05-22).

## Global Constraints

- Ninguna variable `VITE_EVOLUTION_*` puede quedar en `conversai-builder/src`, `.env*` ni en el bundle `dist/`.
- Backend lee `EVOLUTION_API_URL` y `EVOLUTION_API_KEY` (ya existen en EasyPanel y en `backend/.env.example`). Nueva variable opcional `WHATSAPP_INCOMING_WEBHOOK_URL`, default `https://easy-agents-n8n.ftppdk.easypanel.host/webhook/whatsapp-incoming-generic-v2` (valor actual de `WHATSAPP_WEBHOOK_URL` en `WAConnectionsSection.tsx:55`).
- Permisos iguales a la RLS actual de `whatsapp_lines`: **ver/sincronizar** = miembro activo del cliente o `super_admin`; **crear/reconectar/desconectar/borrar** = `role = 'admin'` del cliente o `super_admin`.
- Estados permitidos (enum `whatsapp_line_status`): `pending`, `connected`, `disconnected`, `error`.
- Mensajes de error al usuario en español, como el resto del backend.
- Endpoints bajo el prefijo `api/` (el backend no usa `setGlobalPrefix`; cada controller lo pone, ej. `@Controller('api/notifications')`).
- Asignar agente a una línea sigue igual (update directo de Supabase con RLS); no se mueve.
- El trigger `check_whatsapp_lines_limit` sigue siendo la fuente del límite de líneas.

## Review Focus

1. **Evolution caído o lento al cargar el panel** → el panel debe mostrar las líneas con el último estado guardado y un aviso, no quedarse vacío ni marcar todo como desconectado. (Test en Task 2: `syncClient` con Evolution lanzando error no cambia `status`.)
2. **Instancia borrada en Evolution pero viva en la DB** (hay casos reales) → `status = 'error'` con `error_message = 'La instancia ya no existe en WhatsApp. Elimina la línea y crea una nueva.'`. (Test en Task 2.)
3. **Límite de líneas alcanzado al crear** → la instancia recién creada en Evolution se borra para no dejar huérfanas, y el usuario ve el mensaje del trigger. (Test en Task 2.)
4. **Usuario de otro cliente o con rol `agent`/`billing` llamando a crear/borrar** → 403. Usuario sin sesión → 401. (Tests en Task 1.)
5. **Línea `pending` cuyo QR expiró** (`close`/`connecting`) → sigue `pending` para que pueda renovar el QR; una línea que estaba `connected` y queda `close`/`connecting` → `disconnected`. (Test en Task 2: tabla de `mapEvolutionState`.)

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `backend/src/common/agent-access.service.ts` (modificar) | + verificación de acceso por `clientId` |
| `backend/src/whatsapp-lines/evolution-instances.client.ts` (crear) | HTTP a Evolution para instancias: create, connect, connectionState, fetchInstances, logout, delete |
| `backend/src/whatsapp-lines/line-state.ts` (crear) | Funciones puras: `extractQr`, `mapEvolutionState`, `phoneFromOwnerJid` |
| `backend/src/whatsapp-lines/whatsapp-lines.service.ts` (crear) | Orquesta Evolution + tabla `whatsapp_lines` |
| `backend/src/whatsapp-lines/whatsapp-lines.controller.ts` (crear) | Endpoints `api/whatsapp-lines` |
| `backend/src/whatsapp-lines/whatsapp-lines.module.ts` (crear) | Módulo; se registra en `app.module.ts` |
| `conversai-builder/src/lib/whatsapp-lines.ts` (crear) | Cliente HTTP del frontend hacia esos endpoints |
| `conversai-builder/src/components/dashboard/WAConnectionsSection.tsx` (modificar) | Quita todo `fetch` a Evolution; usa `lib/whatsapp-lines.ts` |
| `conversai-builder/src/pages/Dashboard.tsx` (modificar) | Quita burbuja flotante; agrega "Enviar feedback" al sidebar |
| `conversai-builder/.env.production`, `.gitignore` (modificar) | Sacar `VITE_EVOLUTION_*`; dejar de trackear `.env.production` |
| `docs/runbooks/rotar-llave-evolution.md` (crear) | Pasos operativos de despliegue y rotación |

---

## Parte A — Evolution al backend + estado real

### Task 1: Acceso por cliente en `AgentAccessService`

**Files:**
- Modify: `backend/src/common/agent-access.service.ts`
- Test: `backend/src/common/agent-access.service.spec.ts` (crear)

**Interfaces:**
- Produces:
  - `assertClientAccess(authHeader: string | undefined, clientId: string, level: 'view' | 'manage'): Promise<void>`. Lanza `UnauthorizedException('Falta iniciar sesión' | 'Sesión inválida')` o `ForbiddenException('No tienes permiso sobre este cliente')`.
  - Refactor interno: extraer `private async resolveMembers(authHeader): Promise<{ userId: string; members: { client_id: string; role: string }[] }>` y usarlo también en `assertCanManage` (sin cambiar su comportamiento).

- [ ] **Step 1: Tests** en `agent-access.service.spec.ts`, con un `db` falso al estilo de `notifications.service.spec.ts` (`auth.getUser` y `from('client_members')`):
  - `sin token → 401 'Falta iniciar sesión'`
  - `token inválido → 401 'Sesión inválida'`
  - `view: miembro activo con role 'agent' del mismo cliente → ok`
  - `manage: role 'agent' del mismo cliente → 403`
  - `manage: role 'admin' del mismo cliente → ok`
  - `manage: role 'admin' de OTRO cliente → 403`
  - `manage: super_admin de cualquier cliente → ok`
  - `assertCanManage sigue: agent-manager del cliente dueño del agente → ok`
- [ ] **Step 2:** `cd backend && npx jest src/common/agent-access.service.spec.ts` → FAIL (`assertClientAccess is not a function`).
- [ ] **Step 3:** Implementar. `view` = cualquier miembro activo de `clientId` o `super_admin`; `manage` = `role === 'admin'` de `clientId` o `super_admin`.
- [ ] **Step 4:** Mismo comando → PASS. `npx jest` completo → PASS.
- [ ] **Step 5:** Commit `✨ feat(backend): verificar acceso del usuario por cliente`.

### Task 2: Cliente de instancias, lógica de estado y servicio de líneas

**Files:**
- Create: `backend/src/whatsapp-lines/line-state.ts`, `backend/src/whatsapp-lines/evolution-instances.client.ts`, `backend/src/whatsapp-lines/whatsapp-lines.service.ts`
- Test: `backend/src/whatsapp-lines/line-state.spec.ts`, `backend/src/whatsapp-lines/whatsapp-lines.service.spec.ts`

**Interfaces:**
- Consumes: `DatabaseService.getAdminClient()`, `ConfigService`.
- Produces:
  - `line-state.ts`:
    - `type EvolutionState = 'open' | 'connecting' | 'close' | 'not_found'`
    - `type LineStatus = 'pending' | 'connected' | 'disconnected' | 'error'`
    - `extractQr(data: any): string | null`, que porta la cascada actual de `WAConnectionsSection.tsx:222-250` (base64 con prefijo `data:image/png;base64,` si falta → pairingCode → code → qr).
    - `mapEvolutionState(state: EvolutionState, current: LineStatus): LineStatus`
    - `phoneFromOwnerJid(jid: string | null | undefined): string | null`, que devuelve la parte antes de `@`.
  - `EvolutionInstancesClient` (`@Injectable`), con base y llave de `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` y timeout de 15 s por llamada:
    - `create(instanceName: string, webhookUrl: string): Promise<any>` envía `POST /instance/create` con el mismo body de hoy (`qrcode: true`, `integration: 'WHATSAPP-BAILEYS'`, webhook `{enabled: true, url, byEvents: false, base64: true, events: ['MESSAGES_UPSERT']}`).
    - `connect(instanceName): Promise<any>` → `GET /instance/connect/:name`
    - `connectionState(instanceName): Promise<EvolutionState>` → `GET /instance/connectionState/:name`. Si responde 404, devuelve `'not_found'`.
    - `ownerJid(instanceName): Promise<string | null>` → `GET /instance/fetchInstances?instanceName=`
    - `logout(instanceName): Promise<void>` → `DELETE /instance/logout/:name`
    - `remove(instanceName): Promise<void>` → `DELETE /instance/delete/:name`. Un 404 cuenta como éxito.
    - Cualquier otro error lanza `Error('WhatsApp (Evolution) no respondió: <status>')`.
  - `WhatsAppLinesService`:
    - `listAndSync(clientId: string): Promise<{ lines: WhatsAppLineRow[]; syncError: string | null }>`
    - `refresh(lineId: string): Promise<WhatsAppLineRow>`
    - `create(clientId: string, lineName: string): Promise<WhatsAppLineRow>`
    - `reconnect(lineId: string): Promise<WhatsAppLineRow>`
    - `logout(lineId: string): Promise<WhatsAppLineRow>`
    - `remove(lineId: string): Promise<void>`
    - `clientIdOf(lineId: string): Promise<string>`. Lanza `NotFoundException('Línea no encontrada')`.
    - `WhatsAppLineRow` tiene las mismas columnas que la interfaz `WhatsAppLine` de `WAConnectionsSection.tsx:57-70`.

- [ ] **Step 1: Test de `mapEvolutionState`** como tabla en `line-state.spec.ts`:

  | state \ current | pending | connected | disconnected | error |
  |---|---|---|---|---|
  | open | connected | connected | connected | connected |
  | connecting | pending | disconnected | disconnected | disconnected |
  | close | pending | disconnected | disconnected | disconnected |
  | not_found | error | error | error | error |

  Más tests de `extractQr`:
  - `{qrcode:{base64:'abc'}}` → `'data:image/png;base64,abc'`
  - `{base64:'data:image/png;base64,x'}` → se devuelve igual
  - `{pairingCode:'ABCD'}` → `'ABCD'`
  - `{}` → `null`

  Y de `phoneFromOwnerJid`: `'573219385629@s.whatsapp.net'` → `'573219385629'`, y `null` → `null`.
- [ ] **Step 2:** `npx jest src/whatsapp-lines/line-state.spec.ts` → FAIL.
- [ ] **Step 3:** Implementar `line-state.ts`.
- [ ] **Step 4:** Mismo comando → PASS.
- [ ] **Step 5: Tests de `WhatsAppLinesService`** en `whatsapp-lines.service.spec.ts`, con el cliente de Evolution y la DB falsos:
  - **Sync conectado:** `listAndSync: línea 'connected' y Evolution 'close' → guarda status 'disconnected' y la devuelve así`
  - **Sync reconectado:** `listAndSync: línea 'disconnected' y Evolution 'open' → status 'connected', last_connected_at seteado, qr_code null, phone_number desde ownerJid`
  - **Instancia borrada:** `listAndSync: Evolution 'not_found' → status 'error' con error_message 'La instancia ya no existe en WhatsApp. Elimina la línea y crea una nueva.'`
  - **Evolution caído:** `listAndSync: connectionState lanza → no hace update, devuelve las filas tal cual y syncError 'No se pudo consultar WhatsApp; se muestra el último estado guardado.'`
  - **Sin cambios:** `listAndSync: estado sin cambios → no hace update`
  - **Crear:** `create: crea instancia con nombre /^line_\d+_[a-z0-9]{9}$/ y webhook WHATSAPP_INCOMING_WEBHOOK_URL, inserta fila pending con qr`
  - **Límite alcanzado:** `create: insert falla con 'Límite de 3 líneas…' → llama remove(instanceName) y lanza BadRequestException con ese mensaje`
  - **Reconectar:** `reconnect: guarda qr nuevo y status 'pending'`
  - **Desconectar:** `logout: llama logout y guarda status 'disconnected', phone_number null, qr_code null`
  - **Borrar:** `remove: borra en Evolution y luego la fila`
- [ ] **Step 6:** `npx jest src/whatsapp-lines` → FAIL.
- [ ] **Step 7:** Implementar el cliente y el servicio. En `listAndSync` se consultan las líneas en paralelo con `Promise.allSettled`. Solo se hace `update` cuando cambian `status`, `phone_number` o `error_message`. Al pasar a `connected` se escriben `last_connected_at = now()` y `qr_code = null`, y se pide `ownerJid`. Al salir de `error` se limpia `error_message`.
- [ ] **Step 8:** `npx jest` → PASS.
- [ ] **Step 9:** Commit `✨ feat(backend): gestión de líneas de WhatsApp y estado real desde Evolution`.

### Task 3: Controller y módulo

**Files:**
- Create: `backend/src/whatsapp-lines/whatsapp-lines.controller.ts`, `backend/src/whatsapp-lines/whatsapp-lines.module.ts`
- Modify: `backend/src/app.module.ts` (registrar el módulo), `backend/.env.example` (agregar `WHATSAPP_INCOMING_WEBHOOK_URL=`)
- Test: `backend/src/whatsapp-lines/whatsapp-lines.controller.spec.ts`

**Interfaces:**
- Consumes: Task 1 `assertClientAccess` y Task 2 `WhatsAppLinesService`.
- Produces: estos endpoints (todos piden `Authorization: Bearer <jwt supabase>`):

  | Método y ruta | Body | Acceso | Respuesta |
  |---|---|---|---|
  | `GET api/whatsapp-lines?clientId=` | — | view | `{ lines, syncError }` |
  | `POST api/whatsapp-lines` | `{ clientId, lineName }` | manage | `{ line }` |
  | `POST api/whatsapp-lines/:id/refresh` | — | view | `{ line }` |
  | `POST api/whatsapp-lines/:id/reconnect` | — | manage | `{ line }` |
  | `POST api/whatsapp-lines/:id/logout` | — | manage | `{ line }` |
  | `DELETE api/whatsapp-lines/:id` | — | manage | `{ ok: true }` |

  Los DTO usan `class-validator`: `clientId` con `@IsUUID()` y `lineName` con `@IsString() @IsNotEmpty() @MaxLength(100)`. Las rutas que reciben `:id` resuelven `clientIdOf(id)` y luego llaman a `assertClientAccess`.

- [ ] **Step 1: Tests del controller** (servicio y acceso simulados):
  - `GET llama assertClientAccess(auth, clientId, 'view') y devuelve { lines, syncError }`
  - `POST /:id/logout resuelve clientIdOf(id) y exige 'manage' antes de llamar logout`
  - `si assertClientAccess lanza 403, no se llama al servicio`
- [ ] **Step 2:** `npx jest src/whatsapp-lines/whatsapp-lines.controller.spec.ts` → FAIL.
- [ ] **Step 3:** Implementar el controller y el módulo. El módulo registra `WhatsAppLinesController`, `WhatsAppLinesService`, `EvolutionInstancesClient` y `AgentAccessService`, igual que `notifications.module.ts`.
- [ ] **Step 4:** Validar:
  - `npx jest` → PASS
  - `npm run build` → sin errores
  - `npm run start:dev` con `.env` local y `curl -s localhost:3001/api/whatsapp-lines?clientId=<uuid>` sin token → `401`
- [ ] **Step 5:** Commit `✨ feat(backend): endpoints api/whatsapp-lines`.

### Task 4: Frontend usa el backend y deja de conocer la llave

**Files:**
- Create: `conversai-builder/src/lib/whatsapp-lines.ts`
- Modify: `conversai-builder/src/components/dashboard/WAConnectionsSection.tsx`, `conversai-builder/.env.production`, `conversai-builder/.env.local`, `.gitignore` de la raíz o `conversai-builder/.gitignore`

**Interfaces:**
- Consumes: los endpoints de la Task 3.
- Produces, en `lib/whatsapp-lines.ts` y con el mismo patrón que `GoogleSheetsSection.tsx:10-40` (base `VITE_BACKEND_CHAT_URL` y token de `supabase.auth.getSession()`):
  - `listLines(clientId): Promise<{ lines: WhatsAppLine[]; syncError: string | null }>`
  - `createLine(clientId, lineName): Promise<WhatsAppLine>`
  - `refreshLine(id): Promise<WhatsAppLine>`
  - `reconnectLine(id): Promise<WhatsAppLine>`
  - `logoutLine(id): Promise<WhatsAppLine>`
  - `deleteLine(id): Promise<void>`
  - Si la respuesta no es `ok`, lanzan `Error(body.message)` con el mensaje en español del backend.
  - El tipo `WhatsAppLine` sale de `WAConnectionsSection.tsx` y pasa a exportarse desde este archivo.

- [ ] **Step 1:** Crear `lib/whatsapp-lines.ts`.
- [ ] **Step 2:** En `WAConnectionsSection.tsx`:
  - **Carga de líneas:** `loadData` usa `listLines(clientId)` en lugar del `select` de `whatsapp_lines`. Si viene `syncError`, se muestra como aviso discreto sobre la lista.
  - **Creación:** `handleCreate` → `createLine`.
  - **Escaneo del QR:** los dos pollings (líneas 329 y 590) llaman a `refreshLine(id)` cada 5 s, con el mismo tope de 3 minutos. El de las líneas `pending` se mantiene.
  - **Acciones:** `handleReconnect` → `reconnectLine`, `handleLogout` → `logoutLine` y `handleDeleteLine` → `deleteLine`.
  - **Limpieza:** borrar la constante `WHATSAPP_WEBHOOK_URL`, toda referencia a `VITE_EVOLUTION_*` y los `console.log` de request/response de Evolution.
  - **Asignación de agente:** `handleAssignAgent` no cambia.
- [ ] **Step 3:** Quitar `VITE_EVOLUTION_API_URL`, `VITE_EVOLUTION_API_KEY` y `VITE_EVOLUTION_WEBHOOK_URL` de `.env.production` y `.env.local`. Luego `git rm --cached conversai-builder/.env.production` y agregar `.env.production` al `.gitignore`.
- [ ] **Step 4: Verificar.** Correr esto en `conversai-builder/`:
  ```bash
  grep -rn "VITE_EVOLUTION\|instance/connectionState\|apikey" src .env* ; echo "exit=$?"
  npm run build && grep -rl "$(grep -h '^EVOLUTION_API_KEY=' ../backend/.env | cut -d= -f2)" dist ; echo "exit=$?"
  npm run lint
  ```
  Lo esperado:
  - el primer `grep` no encuentra nada (`exit=1`);
  - el build pasa y el segundo `grep` tampoco encuentra la llave (`exit=1`);
  - el lint pasa.
- [ ] **Step 5: Prueba manual** con `npm run dev` y el backend local apuntando al Supabase de producción en modo lectura:
  - el panel lista las líneas;
  - `573219385629` aparece como **Desconectado** y "Teia Invest" también;
  - el botón ↻ vuelve a sincronizar;
  - no aparece ninguna llamada a `easypanel.host:…/instance` en la pestaña Network.
- [ ] **Step 6:** Commit `🔒 fix(dashboard): las líneas de WhatsApp se gestionan desde el backend; quitar llave de Evolution del frontend`.

### Task 5: Runbook de despliegue y rotación de la llave

**Files:**
- Create: `docs/runbooks/rotar-llave-evolution.md`

Esta tarea no tiene código. El runbook queda en el repo y se ejecuta con confirmación en cada paso que toca producción.

- [ ] **Step 1:** Escribir el runbook con este orden obligatorio, porque cambiarlo deja WhatsApp caído:
  1. **Backend:** mergear las Tasks 1-3 dispara `deploy-backend.yml`. En EasyPanel, poner `NODE_ENV=production` y confirmar que `EVOLUTION_API_URL` y `EVOLUTION_API_KEY` existen. Verificar `GET /api/chat/health`.
  2. **Frontend:** desplegar en Vercel y **borrar `VITE_EVOLUTION_*` de las Environment Variables de Vercel**. Verificar que el bundle publicado no contiene la llave.
  3. **n8n:** reemplazar el `apikey` hardcodeado por una credencial *Header Auth* llamada `Evolution API`. Los nodos conocidos son `Send WhatsApp Response` y `Send Media` en `T86Befb8C8Qq9p8P`. Revisar también `i5-nWn6dxBksSV0mLK16A`, `l77q2rTCCGtMIvco`, `kT4y3CBYJnYETWu3`, `yaRkI4FWpO9gMypd` y `0NyalZlBcjovs5jt` buscando `apikey`.
  4. **Rotar la llave:** generar una nueva (`openssl rand -hex 16 | tr a-f A-F`) y, en una misma ventana corta:
     - cambiar `AUTHENTICATION_API_KEY` del servicio `evolution-api` en EasyPanel y redesplegarlo;
     - cambiar `EVOLUTION_API_KEY` del backend y redesplegarlo;
     - actualizar la credencial `Evolution API` en n8n.
  5. **Verificar:**
     - el panel sincroniza;
     - un mensaje de prueba a una línea conectada recibe respuesta;
     - en los logs del backend no aparece `Evolution respondió 401`;
     - `curl` a `/instance/fetchInstances` con la llave vieja → `401`.
  6. **Pendiente aparte:** la llave vieja sigue en el historial de git. Ya no sirve después de rotarla, así que no hace falta reescribir el historial.
- [ ] **Step 2:** Commit `📝 docs: runbook para desplegar Evolution en backend y rotar la llave`.

---

## Parte B — Feedback al menú lateral

### Task 6: Quitar la burbuja y agregar "Enviar feedback" al sidebar

**Files:**
- Modify: `conversai-builder/src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `FeedbackDialog({ trigger, defaultCategory, metadata })` de `src/components/FeedbackDialog.tsx`, sin cambios.

- [ ] **Step 1: Borrar todo lo de la burbuja** en `Dashboard.tsx`:
  - el estado `feedbackExpanded`, `feedbackHover`, `feedbackPosition`, `isDragging` y `dragStart` (líneas ~80-95);
  - el efecto de arrastre (~100-141);
  - el efecto de animación cada 60 s (~309-327);
  - el bloque JSX `Floating Feedback Button - Draggable` (~531-597);
  - el uso de `localStorage` `feedback-position`.
- [ ] **Step 2: Agregar el botón al sidebar.** En el `<div className="border-t border-border p-2">` del sidebar, encima de "Cerrar sesión", poner un `FeedbackDialog` cuyo `trigger` sea un `<button>` con las mismas clases que los items de navegación inactivos:
  - icono `MessageSquare` y texto `Enviar feedback`;
  - `title` cuando el sidebar está colapsado;
  - `defaultCategory` con el mapeo actual de líneas ~582-590, extraído a una función `feedbackCategoryFor(section: SectionId)`;
  - `metadata={{ section: activeSection, userRole }}`.
- [ ] **Step 3: Verificar.**
  - `npm run build && npm run lint` pasan.
  - En `npm run dev`: no hay botón flotante; el sidebar expandido muestra "Enviar feedback" sobre "Cerrar sesión"; colapsado muestra solo el icono con tooltip.
  - El diálogo se abre con la categoría de la sección activa: en Conexiones WA, `whatsapp`.
  - `grep -n "feedbackPosition\|isDragging" src/pages/Dashboard.tsx` no encuentra nada.
- [ ] **Step 4:** Commit `💄 feat(dashboard): feedback en el menú lateral en lugar del botón flotante`.

---

## Parte C — Navegación fluida en todo el dashboard (sin recargas visibles)

**Causa raíz (verificada en código):** al volver a la pestaña Supabase emite `onAuthStateChange`; `AuthContext.tsx:31` hace `setUser` con un objeto nuevo aunque sea el mismo usuario → `useClientContext` (`use-client-context.ts:25`) vuelve a `isLoading = true` → los 7 efectos que dependen de `[user, clientId, loadingClientId]` hacen `setLoading(true)` → skeleton en todas las secciones. Además cada sección pide el `clientId` por su cuenta al montarse y vuelve a mostrar skeleton al navegar entre secciones.

**Regla:** el skeleton solo se muestra la primera vez que una vista no tiene datos. Toda recarga posterior (foco, polling, volver a una sección, después de guardar) actualiza los datos en silencio.

### Task 7: Usuario estable y `clientId` compartido

**Files:** Modify `src/context/AuthContext.tsx`, `src/hooks/use-client-context.ts`, `src/App.tsx`

- [ ] `AuthContext`: `setUser(prev => (prev?.id === next?.id && event !== 'USER_UPDATED') ? prev : next)`; `session` sí se actualiza siempre.
- [ ] `useClientContext` con React Query: `queryKey: ['client-context', user.id, impersonationRaw]`, `staleTime: Infinity`; `impersonationRaw` leído con `useSyncExternalStore` escuchando `storage` e `impersonation-changed`. Misma salida `{ clientId, isLoading, isImpersonating }`; `isLoading` solo es `true` mientras no hay dato en caché.
- [ ] `QueryClient` con defaults `staleTime: 30_000`, `gcTime: 30 * 60_000`, `retry: 1`.

### Task 8: Datos de secciones en caché con recarga silenciosa

**Files:** `OverviewSection`, `AgentsSection`, `AccountSection`, `WAConnectionsSection` (lista), `GoogleSheetsSection`, `NotificationsSection`, `AgentAssetsSection`, `AgentEditor`

- [ ] Secciones de primer nivel (Panel General, Agentes, Cuenta): la carga principal pasa a `useQuery` con clave por `clientId` → al volver a la sección se ve el dato en caché al instante y se refresca en segundo plano.
- [ ] Cargas que se repiten dentro de una vista montada (guardar, polling, reconectar): solo ponen `loading = true` si aún no hay datos.
- [ ] Verificación: con la app local, cambiar de pestaña y volver, navegar Agentes → Conexiones → Agentes, y esperar un ciclo de polling: ningún skeleton tras la primera carga (MutationObserver contando `.animate-pulse`).

## Parte D — Node 24 LTS

Node 20 (`backend/Dockerfile: FROM node:20-alpine`, en producción v20.20.2) está fuera de soporte desde 2026-04-30: ya no recibe parches de seguridad.

### Task 9: Subir a Node 24

**Files:** `backend/Dockerfile`, `backend/package.json`, `conversai-builder/package.json`, `.nvmrc` (raíz)

- [ ] `FROM node:24-alpine`; `"engines": { "node": ">=24 <25" }` en ambos `package.json` (Vercel toma la versión de `engines`); `.nvmrc` con `24`.
- [ ] Verificar: `docker build` del backend y `docker run` → `/api/chat/health` 200; `npm run build` del frontend con Node 24.

## Ajuste a la Task 2/4 — QR que se renueva

Evolution regenera el QR cada ~45 s; hoy el panel muestra solo el primero y por eso escanear tarde falla sin dejar rastro en Evolution. `refresh(lineId)` en una línea `pending` que sigue en `connecting` pide `GET /instance/connect/:name`, guarda el QR nuevo en `qr_code` y lo devuelve; el polling del frontend pinta el QR que llega.

## Mejora acordada: deprecar n8n en la atención de WhatsApp

Desde la Fase 1 de la API oficial, el backend atiende WhatsApp de punta a punta (webhook de Meta → `ChatService` → Graph API) sin n8n. Las líneas por QR todavía pasan por el workflow v2 de n8n (Evolution → n8n → `/api/chat/message` → Evolution).

**Objetivo:** que Evolution envíe su webhook al backend (`/api/whatsapp-evolution/webhook`) y un solo módulo atienda las dos clases de línea con la misma lógica:
- normalización del mensaje, deduplicación, transcripción de audio (Whisper) y envío de archivos;
- envío por el proveedor de la línea (`evolution` o `meta_cloud`).

**Por qué:** mayor control y estándares (tests, revisión de código, tipos), mejor rendimiento (menos saltos), un solo lugar para errores y métricas. También elimina problemas de n8n ya detectados: SQL interpolado en `Execute Query`, reacciones que fallan con 400, errores por mensajes propios (`fromMe`) y la llave de Evolution escrita en nodos.

**Cómo:** migrar línea por línea cambiando la URL del webhook de cada instancia de Evolution; mantener el workflow de n8n hasta que la última línea esté migrada y luego desactivarlo.

## Mejoras para líneas por la API oficial (Fase 3)

- ✅ **"Escribiendo…"** (PR #33): enviar `typing_indicator: { type: "text" }` junto con el `status: "read"` al recibir el mensaje (permiso `whatsapp_business_messaging`; dura hasta 25 s o hasta la respuesta).
- ✅ **Audio entrante:** `GET /{media_id}` → URL temporal (5 min) → descarga con el token → transcripción con `gpt-4o-mini-transcribe` (configurable con `OPENAI_TRANSCRIBE_MODEL`) → texto al agente. AAC y AMR no se pueden transcribir: se pide escribirlo. Pendiente: cobrar la transcripción en los tokens del cliente.
- ✅ **"Conectar con Facebook" (Embedded Signup):** el admin del cliente abre el popup de Meta (SDK de JS, `config_id` de Facebook Login for Business), elige su empresa y número; el backend cambia el `code` por el token de negocio del cliente, suscribe la app a su WABA, registra el número con un PIN aleatorio y guarda la línea con el token cifrado (AES-256-GCM, `WHATSAPP_TOKEN_ENCRYPTION_KEY`) en `whatsapp_lines.meta_access_token_encrypted`. El webhook responde por cada línea con su propio token (o el de la plataforma si no tiene). El navegador ya no puede leer esa columna ni crear líneas directo en la tabla. Requiere Tech Provider aprobado para clientes externos.
  - ✅ **Respaldo sin IDs:** si el cliente ya había autorizado la app y pulsa "Continuar", Meta no envía `phone_number_id`/`waba_id`; el backend los descubre con `debug_token` (`granular_scopes`) + `/{waba}/phone_numbers` y solo conecta si hay un único número libre.
  - ✅ **Renovación de tokens (60 días):** cron diario del backend (`MetaTokenRenewalService`, 8 a. m. Bogotá) renueva con `fb_exchange_token` + `set_token_expires_in_60_days=true` los que vencen en ≤ 15 días; si falla, `meta_token_refresh_error` se muestra en Conexiones WA. Plan: `2026-11-05-conectar-facebook-robusto.md`.
  - Pendiente: guardar el PIN de verificación en dos pasos (hoy se genera y se descarta; el cliente puede cambiarlo en WhatsApp Manager) y reconectar una línea existente (hoy hay que eliminarla y volver a conectar).
- **Conversiones de anuncios de clic a WhatsApp:** guardar el `ctwa_clid` del `referral` que trae el webhook y enviar los eventos del agente (Lead, Purchase) por la API de Conversiones para mensajes de negocios (`action_source: business_messaging`, `messaging_channel: whatsapp`) con el token de la conexión del cliente, en lugar del pixel + token manual de `meta_ads_config`. Requiere `whatsapp_business_manage_events` con acceso avanzado: **segunda App Review**, separada de la de `whatsapp_business_messaging` y `whatsapp_business_management`.

## Fuera de alcance (anotado para después)

- Recibir `CONNECTION_UPDATE` de Evolution en tiempo real: hoy cada instancia tiene un solo webhook y apunta a n8n. Si hace falta, se agrega un cron en el backend con `@nestjs/schedule` que llame a `listAndSync` por cliente.
- `Execute Query` del workflow v2 interpola `body.instance` dentro del SQL (`'{{ $json.body.instance }}'`), lo que permite inyección SQL desde el webhook. Conviene pasarlo a query parameters.
- El workflow v2 manda a `/api/chat/message` las reacciones con texto vacío y fallan con 400.
