# Conectar con Facebook robusto (respaldo + renovación de tokens) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que "Conectar con Facebook" funcione aunque Meta no envíe el número por `postMessage`, y que el token de cada cliente (60 días) se renueve solo antes de vencer.

**Architecture:** El backend descubre la WABA y el número con el token recién intercambiado (`debug_token` → `granular_scopes` → `/{waba}/phone_numbers`) cuando el navegador no los trae. Un cron diario (`@nestjs/schedule`) renueva con `grant_type=fb_exchange_token` + `set_token_expires_in_60_days=true` los tokens que vencen en ≤ 15 días y guarda la fecha nueva.

**Tech Stack:** NestJS 11, Supabase (Postgres), React + Vite, Graph API v25.0.

**Spec:** esta conversación (2026-11-05) + docs de Meta:
- Respaldo: popup "Anteriormente vinculaste EasyAgents… Continuar" no emite `WA_EMBEDDED_SIGNUP` (verificado con HAR y consola).
- Renovación: https://developers.facebook.com/docs/business-management-apis/system-users/install-apps-and-generate-tokens#types-of-system-access-tokens

## Mapa actual (lo que ya existe)

| Pieza | Archivo | Notas |
|---|---|---|
| Popup + `postMessage` | `conversai-builder/src/lib/facebook-embedded-signup.ts` | Hoy falla con "Meta no indicó qué número…" si llega el `code` sin IDs (timeout 10 s). |
| Diálogo | `conversai-builder/src/components/dashboard/WAConnectionsSection.tsx` (`ConnectFacebookDialog`, ~L413) | |
| API front | `conversai-builder/src/lib/whatsapp-lines.ts` → `connectWithEmbeddedSignup(clientId, lineName, signup)` | |
| DTO + endpoint | `backend/src/whatsapp-lines/whatsapp-lines.controller.ts` → `EmbeddedSignupDto`, `POST meta/embedded-signup` | `phoneNumberId`/`wabaId` hoy obligatorios. |
| Flujo | `backend/src/whatsapp-lines/whatsapp-lines.service.ts` → `connectWithEmbeddedSignup(...)` | Chequea llave, cupo y duplicado **antes** de gastar el code. |
| Graph | `backend/src/whatsapp-cloud/whatsapp-cloud.client.ts` | `exchangeCode`, `subscribeApp`, `registerPhoneNumber`, `getPhoneNumber`; `request(..., token)` con `token === null` = sin Authorization. |
| Cifrado | `backend/src/whatsapp-cloud/token-crypto.ts` | `encryptToken` / `decryptToken`, env `WHATSAPP_TOKEN_ENCRYPTION_KEY`. |
| Columnas | `whatsapp_lines.meta_access_token_encrypted` | El navegador solo tiene `GRANT SELECT (columnas…)` (migración `20261105140000`); **toda columna nueva visible debe agregarse a ese GRANT** y a `LINE_COLUMNS`. |

## Global Constraints

- Graph `v25.0` (`META_GRAPH_VERSION`); app token para `debug_token` = `${META_APP_ID}|${META_APP_SECRET}`, nunca se loguea.
- El token del cliente nunca sale del backend ni aparece en logs/respuestas.
- Textos al usuario en español; mensajes de error accionables.
- Migraciones repetibles (`IF NOT EXISTS`), se aplican con `supabase db push` desde el PC del usuario.
- Tests: `cd backend && npx jest --no-watchman` (solo pueden fallar los 4 "should be defined" preexistentes); front: `npx tsc --noEmit` sin errores nuevos + `npm run build`.

## Review Focus

1. Cliente con **varias** WABAs/números autorizados y sin IDs del popup → no elegir uno al azar: error que pide "Editar configuración" y elegir un solo número.
2. Número descubierto **ya conectado** en otra línea → "Ese número ya está conectado a una línea." (el chequeo previo no corrió porque no había ID).
3. Token con `expires_at = 0` (no vence) → `meta_token_expires_at = null` y el cron lo ignora.
4. Renovación que falla (token revocado por cambio de contraseña) → la línea queda marcada y visible en el panel; el cron no se cae para las demás.
5. Dos renovaciones simultáneas (deploy + cron) → la segunda no rompe: actualizar con `.eq('meta_access_token_encrypted', anterior)`.

---

### Task 1: Métodos de Graph para descubrir y renovar

**Files:**
- Modify: `backend/src/whatsapp-cloud/whatsapp-cloud.client.ts`
- Test: `backend/src/whatsapp-cloud/whatsapp-cloud.spec.ts`

**Interfaces:**
- Produces:
  - `debugToken(token: string): Promise<{ expiresAt: Date | null; wabaIds: string[] }>` — `GET debug_token?input_token=…` con `Authorization: Bearer ${appId}|${appSecret}`; `expires_at` 0 → `null`; `wabaIds` = `target_ids` de los `granular_scopes` con `scope` `whatsapp_business_management` (sin duplicados).
  - `listPhoneNumbers(wabaId: string, token: AccessToken): Promise<{ id: string; displayPhoneNumber: string }[]>` — `GET {waba}/phone_numbers?fields=id,display_phone_number`.
  - `refreshToken(token: string): Promise<{ accessToken: string; expiresAt: Date | null }>` — `GET oauth/access_token?grant_type=fb_exchange_token&client_id&client_secret&fb_exchange_token&set_token_expires_in_60_days=true` sin Authorization; `expires_in` (s) → fecha.

- [ ] **Step 1: Tests** (`describe('WhatsAppCloudClient')`):
  - `debugToken` arma la URL con `input_token` y app token, devuelve `{ expiresAt: new Date(1790000000*1000), wabaIds: ['W1','W2'] }` desde `{data:{expires_at:1790000000, granular_scopes:[{scope:'whatsapp_business_management',target_ids:['W1','W2']},{scope:'whatsapp_business_messaging',target_ids:['W1']}]}}`.
  - `debugToken` con `expires_at: 0` → `expiresAt: null`.
  - `listPhoneNumbers('W1','tok')` → `[{id:'PN9', displayPhoneNumber:'+57 300 111 2233'}]`.
  - `refreshToken('old')` → URL contiene `grant_type=fb_exchange_token`, `fb_exchange_token=old`, `set_token_expires_in_60_days=true`, sin header Authorization; `{access_token:'new', expires_in:5184000}` → `{ accessToken:'new', expiresAt: ≈ now+60d }`.
  - Sin `META_APP_ID`/`META_APP_SECRET` → lanza sin llamar a fetch.
- [ ] **Step 2:** `npx jest --no-watchman src/whatsapp-cloud` → FAIL (métodos no existen).
- [ ] **Step 3:** Implementar; reutilizar la lectura de `META_APP_ID`/`META_APP_SECRET` que ya usa `exchangeCode` (extraer `private appCredentials()`).
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5:** Commit `✨ feat: consultar y renovar tokens de clientes en Graph`.

### Task 2: Columnas de vencimiento

**Files:**
- Create: `supabase/migrations/20261106120000_whatsapp_lines_meta_token_expiry.sql`
- Modify: `backend/src/whatsapp-lines/whatsapp-lines.service.ts` (`WhatsAppLineRow`, `LINE_COLUMNS`), `conversai-builder/src/lib/whatsapp-lines.ts` (`WhatsAppLine`)

**Interfaces:**
- Produces: columnas `meta_token_expires_at timestamptz null`, `meta_token_refresh_error text null`; ambas en `GRANT SELECT (...) TO authenticated` (no son secretas) y en `LINE_COLUMNS`.

- [ ] **Step 1:** Migración con `ADD COLUMN IF NOT EXISTS` + `GRANT SELECT (meta_token_expires_at, meta_token_refresh_error) ON public.whatsapp_lines TO authenticated` + `COMMENT`s.
- [ ] **Step 2:** Aplicar dos veces en local (`docker exec -i supabase_db_easy-agents psql … < archivo`) → sin errores; con un JWT `authenticated` local, `select meta_token_expires_at` → 200 y `select meta_access_token_encrypted` → 403.
- [ ] **Step 3:** Tipos en back y front.
- [ ] **Step 4:** Commit `🗃️ feat: guardar vencimiento del token de Meta por línea`.

### Task 3: Respaldo cuando el popup no trae el número

**Files:**
- Modify: `backend/src/whatsapp-lines/whatsapp-lines.service.ts`, `backend/src/whatsapp-lines/whatsapp-lines.controller.ts`
- Test: `backend/src/whatsapp-lines/whatsapp-lines.service.spec.ts`, `backend/src/whatsapp-lines/whatsapp-lines.controller.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`debugToken`, `listPhoneNumbers`), Task 2 (columnas).
- Produces:
  - `connectWithEmbeddedSignup(clientId, lineName, code, phoneNumberId: string | null, wabaId: string | null)`.
  - `EmbeddedSignupDto.phoneNumberId?` / `wabaId?` opcionales, pero **ambos o ninguno** (validar en el controller → 400 "Faltan datos del número de Meta").
  - Constantes exportadas: `NO_NUMBER_MESSAGE = 'Meta no compartió ningún número. Vuelve a conectar y, si aparece "Anteriormente vinculaste EasyAgents", pulsa "Editar configuración" y elige tu número.'`, `MANY_NUMBERS_MESSAGE = 'Autorizaste varios números. Vuelve a conectar, pulsa "Editar configuración" y elige solo el número que quieres usar.'`.

- [ ] **Step 1: Tests** (servicio, con `cloud` falso):
  - Sin IDs: `debugToken` → `wabaIds:['W1']`, `listPhoneNumbers` → un número libre → usa `W1`/`PN1`: `subscribeApp('W1', tok)`, `registerPhoneNumber('PN1', …)`, inserta con `meta_token_expires_at` = `expiresAt`.
  - Sin IDs y 0 números → `BadRequest(NO_NUMBER_MESSAGE)`, no inserta.
  - Sin IDs y 2 números libres → `BadRequest(MANY_NUMBERS_MESSAGE)`.
  - Sin IDs, 2 números de los cuales 1 ya está en `whatsapp_lines` → usa el libre.
  - Sin IDs y el único número ya conectado → `BadRequest(DUPLICATED_NUMBER_MESSAGE)`.
  - Con IDs: no llama a `listPhoneNumbers`; sí llama a `debugToken` (para el vencimiento).
  - Controller: solo `phoneNumberId` sin `wabaId` → 400.
- [ ] **Step 2:** Tests → FAIL.
- [ ] **Step 3:** Implementar `private async resolveSignupNumber(token, phoneNumberId, wabaId): Promise<{ phoneNumberId: string; wabaId: string }>`; mantener el chequeo previo de duplicado solo cuando viene `phoneNumberId`; repetir el chequeo tras descubrir.
- [ ] **Step 4:** Tests → PASS; suite completa verde (salvo los 4 conocidos).
- [ ] **Step 5:** Commit `🐛 fix: conectar con Facebook aunque Meta no envíe el número`.

### Task 4: Frontend acepta el code sin IDs

**Files:**
- Modify: `conversai-builder/src/lib/facebook-embedded-signup.ts`, `conversai-builder/src/lib/whatsapp-lines.ts`, `conversai-builder/src/components/dashboard/WAConnectionsSection.tsx`

**Interfaces:**
- Produces: `EmbeddedSignupResult = { code: string; phoneNumberId: string | null; wabaId: string | null }`; si llega el `code` y no hay IDs a los `IDS_TIMEOUT_MS` (10 s) **resuelve** con `null`s en vez de rechazar. `FINISH*` sin IDs también resuelve con `null`s. `connectWithEmbeddedSignup` omite las claves nulas en el body.

- [ ] **Step 1:** Cambiar tipos y la rama de timeout/FINISH; el texto del diálogo agrega: "Si Facebook te dice que ya vinculaste EasyAgents, pulsa **Editar configuración** para elegir el número."
- [ ] **Step 2:** `npx tsc --noEmit` (sin errores nuevos vs `main`) y `npm run build` → OK.
- [ ] **Step 3:** Prueba local con Graph simulada (`scratchpad/mock_graph.py` del #36, ampliado con `debug_token` y `phone_numbers`): POST al endpoint sin IDs → línea creada con `meta_token_expires_at`.
- [ ] **Step 4:** Commit `🐛 fix: aceptar la conexión de Facebook cuando Meta no envía los IDs`.

### Task 5: Renovación automática diaria

**Files:**
- Modify: `backend/package.json` (+ `@nestjs/schedule`), `backend/src/app.module.ts` (`ScheduleModule.forRoot()`), `backend/src/whatsapp-lines/whatsapp-lines.module.ts`
- Create: `backend/src/whatsapp-lines/meta-token-renewal.service.ts`, `backend/src/whatsapp-lines/meta-token-renewal.service.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`refreshToken`, `debugToken`), Task 2.
- Produces: `MetaTokenRenewalService.renewDueTokens(now = new Date()): Promise<{ renewed: number; failed: number; filled: number }>`, decorado `@Cron('0 8 * * *', { timeZone: 'America/Bogota' })` vía un método `handleCron()` que llama a `renewDueTokens()`. Constante `RENEW_WINDOW_DAYS = 15`.

- [ ] **Step 1: Tests** (db y cloud falsos, `now` fijo):
  - Línea con token y `expires_at` = now+10d → `refreshToken` → guarda token nuevo cifrado (≠ anterior), `meta_token_expires_at` nuevo, `meta_token_refresh_error = null`; `renewed: 1`.
  - `expires_at` = now+30d → no toca.
  - `expires_at` null y token presente → `debugToken` llena la fecha (`filled: 1`); si vence en ≤ 15 d, además renueva.
  - Línea sin token (plataforma) → ignorada.
  - `refreshToken` lanza → `meta_token_refresh_error` = `'No se pudo renovar el acceso a Meta: <msg>. Reconecta con Facebook.'`, `failed: 1`, sigue con la siguiente.
  - El update filtra `.eq('meta_access_token_encrypted', anterior)` (Review Focus 5).
- [ ] **Step 2:** Tests → FAIL.
- [ ] **Step 3:** `npm i @nestjs/schedule` (versión compatible con Nest 11), implementar.
- [ ] **Step 4:** Tests → PASS; `npm run build` del backend OK.
- [ ] **Step 5:** Commit `⏰ feat: renovar cada día los tokens de Meta que vencen pronto`.

### Task 6: Aviso en el panel

**Files:**
- Modify: `conversai-builder/src/components/dashboard/WAConnectionsSection.tsx`

- [ ] **Step 1:** En líneas `meta_cloud`: si `meta_token_refresh_error` → bloque rojo con el texto + botón "Reconectar con Facebook" (abre `ConnectFacebookDialog`); si `meta_token_expires_at` < 7 días y sin error → aviso ámbar "El acceso a Meta vence el <fecha>; se renovará automáticamente".
- [ ] **Step 2:** `tsc` + `build` OK; captura en local con una línea de prueba con `meta_token_refresh_error` puesto por SQL.
- [ ] **Step 3:** Commit `💄 feat: avisar cuando el acceso a Meta de una línea no se pudo renovar`.

### Task 7: Cierre

- [ ] Actualizar `docs/superpowers/plans/2026-11-04-evolution-al-backend-y-feedback-en-menu.md` (sección API oficial) y `backend/.env.example` si hace falta.
- [ ] PR contra `main`: qué hace, migración a aplicar, cómo se probó, qué no se pudo probar (popup real hasta que Meta habilite el Tech Provider).
