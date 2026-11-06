# Plantillas de WhatsApp para líneas oficiales (avisos fuera de 24 h) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los avisos de "lead completo" al equipo del cliente también salgan cuando el agente usa una línea de la API oficial, enviándolos con una plantilla aprobada por Meta.

**Architecture:** Hoy el único mensaje que **inicia** EasyAgents es el aviso de lead (`NotificationsService`); el agente solo responde dentro de la ventana de 24 h, que no necesita plantilla. Para líneas `meta_cloud`, el backend crea (una vez por WABA) una plantilla de utilidad fija `easyagents_nuevo_contacto`, guarda su estado y envía el aviso con ella; las líneas QR siguen igual por Evolution.

**Tech Stack:** NestJS 11, Supabase, Graph API v25.0 (`/{waba}/message_templates`, mensajes `type: template`).

**Spec:** esta conversación (2026-11-05). Decisión de producto pendiente de confirmar: **una plantilla fija de la plataforma** (no plantillas libres por cliente) para el primer corte.

## Mapa actual

| Pieza | Archivo | Notas |
|---|---|---|
| Avisos | `backend/src/notifications/notifications.service.ts` | `notifyIfComplete`, `notifyPending`, `sendTest`; `instanceOf(agentId)` filtra `provider = 'evolution'` (las líneas oficiales hoy **no** avisan). |
| Texto | `backend/src/notifications/notification-format.ts` | `renderTemplate` con `{{variable}}`, `buildSummary` (líneas `• etiqueta: valor`), `normalizePhone`. |
| Envío QR | `backend/src/notifications/evolution.client.ts` → `sendText(instance, phone, text): Promise<string \| null>` (error o null). | |
| Graph | `backend/src/whatsapp-cloud/whatsapp-cloud.client.ts` | Falta `createTemplate`, `getTemplate`, `sendTemplate`. |
| Token por línea | `whatsapp_lines.meta_access_token_encrypted` + `decryptToken` | Mismo criterio que `WhatsAppCloudService.tokenOf`. |
| UI | `conversai-builder/src/components/dashboard/NotificationsSection.tsx` | Configura plantilla de texto libre y destinatarios. |

## Global Constraints

- Plantilla: nombre `easyagents_nuevo_contacto`, idioma `es`, categoría `UTILITY`, cuerpo exacto:
  `Hola, {{1}} tiene un nuevo contacto listo para atender. Datos: {{2}}. Abrir chat: {{3}}`
  con `example.body_text = [["Teia Invest", "Nombre: Ana · Ciudad: Bogotá", "https://wa.me/573001112233"]]`.
- Parámetros sin saltos de línea, tabs ni más de 4 espacios seguidos (regla de Meta): `{{2}}` = datos unidos con ` · `, máx. 900 caracteres.
- Requiere `whatsapp_business_management` (crear/consultar plantillas) — ya está en la App Review enviada.
- Textos en español; sin tokens en logs. Tests como en el resto del backend.

## Review Focus

1. Plantilla **en revisión o rechazada** cuando llega un lead → no se pierde el aviso: se registra `failed` con motivo claro y `notified_at` vuelve a `null` para reintentar con "Enviar pendientes".
2. Un dato del lead con saltos de línea o emojis → se aplanan antes de enviarse (Meta rechaza `\n` en parámetros).
3. Agente con línea QR **y** oficial → prioridad: línea conectada más reciente (mismo criterio que hoy), según su `provider`.
4. Plantilla ya existente en la WABA (creada a mano o por otro intento) → se reutiliza (Meta responde "already exists"), no falla.
5. Línea oficial con token de plataforma (número de prueba) → usa ese token; WABA desconocida (`meta_waba_id` null) → aviso `failed` "Falta la cuenta de WhatsApp de la línea".

---

### Task 1: Graph de plantillas

**Files:** Modify `backend/src/whatsapp-cloud/whatsapp-cloud.client.ts`; Test `backend/src/whatsapp-cloud/whatsapp-cloud.spec.ts`

**Interfaces (Produces):**
- `createTemplate(wabaId: string, template: TemplateDefinition, token: AccessToken): Promise<{ id: string; status: string }>` — `POST {waba}/message_templates`.
- `findTemplate(wabaId: string, name: string, language: string, token: AccessToken): Promise<{ id: string; status: 'APPROVED' | 'PENDING' | 'REJECTED' | string } | null>` — `GET {waba}/message_templates?name=…&fields=id,name,language,status`.
- `sendTemplate(phoneNumberId: string, to: string, name: string, language: string, params: string[], token: AccessToken): Promise<void>` — mensaje `{ type:'template', template:{ name, language:{code}, components:[{type:'body', parameters: params.map(text=>({type:'text', text}))}] } }`.
- `export interface TemplateDefinition { name: string; language: string; category: 'UTILITY'; body: string; example: string[] }`.

- [ ] Tests: body exacto de cada llamada; `findTemplate` sin resultados → `null`; error de Graph → `BadGatewayException` con el mensaje de Meta.
- [ ] FAIL → implementar → PASS → commit `✨ feat: crear, consultar y enviar plantillas de WhatsApp`.

### Task 2: Estado de la plantilla por WABA

**Files:** Create `supabase/migrations/20261107120000_whatsapp_templates.sql`

- Tabla `public.whatsapp_templates (waba_id varchar(64), name varchar(100), language varchar(10), meta_template_id varchar(64), status varchar(20), rejected_reason text, updated_at timestamptz default now(), primary key (waba_id, name, language))`; RLS activado **sin políticas** (solo backend con service role).
- [ ] Aplicar dos veces en local sin errores; `authenticated` no puede leerla (403/0 filas). Commit `🗃️ feat: guardar el estado de las plantillas de Meta`.

### Task 3: Servicio de plantillas

**Files:** Create `backend/src/whatsapp-cloud/templates.service.ts` (+ spec); Modify `whatsapp-cloud.module.ts` (exportarlo).

**Interfaces (Produces):**
- `NEW_CONTACT_TEMPLATE: TemplateDefinition` (Global Constraints).
- `TemplatesService.ensure(wabaId: string, token: AccessToken): Promise<'APPROVED' | 'PENDING' | 'REJECTED'>` — lee `whatsapp_templates`; si no está o no está `APPROVED`, consulta `findTemplate`; si no existe, `createTemplate`; guarda y devuelve el estado.
- `newContactParams(businessName: string, summaryLines: string[], chatLink: string): string[]` — aplanado y recorte según Global Constraints.

- [ ] Tests: crea si no existe; reutiliza si existe; no vuelve a llamar a Meta si en BD ya está `APPROVED`; `newContactParams` quita `\n`/tabs, colapsa espacios y recorta a 900.
- [ ] FAIL → implementar → PASS → commit `✨ feat: plantilla de aviso de nuevo contacto por cuenta de WhatsApp`.

### Task 4: Avisos por la línea oficial

**Files:** Modify `backend/src/notifications/notifications.service.ts`, `notifications.module.ts` (importar `WhatsAppCloudModule`); Test `notifications.service.spec.ts`

**Interfaces:**
- Consumes: Task 1 `sendTemplate`, Task 3 `ensure`/`newContactParams`.
- Produces: `instanceOf` → `channelOf(agentId): Promise<{ provider: 'evolution'; instance: string } | { provider: 'meta_cloud'; phoneNumberId: string; wabaId: string | null; token: AccessToken } | null>`.

- [ ] Tests: línea oficial + plantilla `APPROVED` → `sendTemplate(PN, phone, 'easyagents_nuevo_contacto', 'es', [negocio, datos, link])`, log `sent`; `PENDING` → log `failed` "La plantilla de aviso está en revisión por Meta", `notified_at` vuelve a null; línea QR → igual que hoy (`evolution.sendText`); `sendTest` con línea oficial usa la plantilla.
- [ ] FAIL → implementar → PASS → commit `✨ feat: enviar avisos de lead por la API oficial con plantilla`.

### Task 5: Visibilidad en el panel

**Files:** Modify `backend/src/notifications/notifications.controller.ts` (`GET api/notifications/:agentId/channel` con `assertCanManage`), `conversai-builder/src/components/dashboard/NotificationsSection.tsx`

- [ ] Si el agente usa línea oficial: mostrar "Los avisos se envían con la plantilla aprobada por Meta" + estado (Aprobada / En revisión / Rechazada con motivo) y aclarar que el texto personalizado solo aplica a líneas QR.
- [ ] `tsc` + `build` OK → commit `💄 feat: estado de la plantilla de avisos en Notificaciones`.

### Task 6: Cierre

- [ ] Prueba local con Graph simulada; prueba real con el número de prueba (la WABA de prueba permite crear plantillas) cuando la App Review esté aprobada.
- [ ] PR con migración a aplicar y la decisión de producto anotada. Fuera de este plan: plantillas libres por cliente, campañas/seguimientos (requieren opt-in y su propio diseño).
