# Supabase Local — Guía de desarrollo

## Requisitos previos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) corriendo
- [Supabase CLI](https://supabase.com/docs/guides/cli) instalado (`brew install supabase/tap/supabase`)

---

## Comandos principales

Todos los comandos se ejecutan desde la raíz del repo (`conversai-builder/`).

### Iniciar
```bash
supabase start
```
Levanta todos los servicios locales (DB, Auth, Studio, etc.).

### Detener
```bash
supabase stop
```

### Resetear la DB (aplica migraciones + seed desde cero)
```bash
supabase db reset
```
> ⚠️ Borra todos los datos locales y los recrea desde las migraciones y `seed.sql`.

---

## URLs locales

| Servicio     | URL                          |
|-------------|-------------------------------|
| Studio (UI) | http://127.0.0.1:54323        |
| API REST    | http://127.0.0.1:54321/rest/v1|
| Auth        | http://127.0.0.1:54321/auth/v1|
| Mailpit     | http://127.0.0.1:54324        |

---

## Credenciales locales

| Campo       | Valor                                        |
|-------------|----------------------------------------------|
| DB Host     | 127.0.0.1                                    |
| DB Port     | 54322                                        |
| DB User     | postgres                                     |
| DB Password | postgres                                     |
| DB Name     | postgres                                     |
| Anon Key    | sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH |
| Service Key | sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz   |

---

## Usuarios de prueba (seed)

| Email             | Contraseña | Rol                |
|-------------------|------------|--------------------|
| admin@test.com    | Test1234!  | admin              |
| agent@test.com    | Test1234!  | agent-administrator|

---

## Migraciones

Las migraciones están en `supabase/migrations/` y se aplican en orden alfabético.

| Archivo                                  | Descripción                          |
|------------------------------------------|--------------------------------------|
| `20260214000000_enable_postgis.sql`      | Habilita extensión PostGIS           |
| `20260214151533_initial_schema.sql`      | Schema inicial (todas las tablas)    |
| `20260218000000_client_members_and_rls.sql` | client_members + RLS policies    |

### Crear una nueva migración
```bash
supabase migration new nombre_de_la_migracion
```
Genera un archivo vacío en `supabase/migrations/` con timestamp.

---

## Exponer Postgres via ngrok (para N8N remoto)

Para que N8N en Easypanel pueda leer/escribir en tu DB local necesitas exponer el puerto de Postgres con un tunnel TCP.

### 1. Instalar ngrok

```bash
brew install ngrok/ngrok/ngrok
```

O descarga desde https://ngrok.com/download

### 2. Autenticarte (solo la primera vez)

```bash
ngrok config add-authtoken TU_TOKEN
```

> Obtén tu token en https://dashboard.ngrok.com/get-started/your-authtoken

### 3. Levantar el tunnel

```bash
ngrok tcp 54322
```

Ngrok mostrará algo como:
```
Forwarding  tcp://6.tcp.ngrok.io:10642 -> localhost:54322
```

### 4. Configurar la credencial en N8N

En N8N → Credentials → Postgres → Nueva credencial:

| Campo    | Valor                  |
|----------|------------------------|
| Host     | `6.tcp.ngrok.io`       |
| Port     | `10642`                |
| Database | `postgres`             |
| User     | `postgres`             |
| Password | `postgres`             |
| SSL      | `disable`              |

> ⚠️ La URL de ngrok gratuito cambia cada vez que reinicias el tunnel. Debes actualizar la credencial en N8N cada vez.

### 5. Workflows locales configurados

Los siguientes workflows en N8N usan la credencial `Postgres account LOCAL`:

| Workflow            | Path webhook                  | Descripción                        |
|---------------------|-------------------------------|------------------------------------|
| `chat-message-local`| `/webhook/chat-message-local` | Chat con IA + historial en DB local|
| `contact-lead-local`| `/webhook/contact-lead-local` | Notificación Gmail (DB via SDK)    |

---

## Variables de entorno del frontend

El archivo `conversai-builder/.env.local` debe tener:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
VITE_N8N_CHAT_WEBHOOK=https://easy-agents-n8n.ftppdk.easypanel.host/webhook/chat-message-local
VITE_N8N_CONTACT_WEBHOOK=https://easy-agents-n8n.ftppdk.easypanel.host/webhook/contact-lead-local
```

---

## Flujo completo de desarrollo local

```bash
# 1. Iniciar Supabase
supabase start

# 2. (Opcional) Resetear DB con datos frescos
supabase db reset

# 3. Iniciar el frontend
cd conversai-builder
npm run dev

# 4. (Opcional) Exponer DB para N8N
ngrok tcp 54322
```
