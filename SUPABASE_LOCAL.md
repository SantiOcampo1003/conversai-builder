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

### ⚠️ Regla: todo cambio de esquema en producción pasa por una migración

No ejecutes `CREATE`/`ALTER`/`DROP` ni políticas desde el SQL Editor de producción.
Si algo se crea a mano, no existe en local, en branches ni en entornos nuevos, y
las migraciones siguientes que lo toquen fallan fuera de producción.

```bash
supabase migration new nombre_del_cambio   # escribir el SQL aquí
supabase db reset                          # probarlo en local
supabase db push --linked --dry-run        # ver qué se aplicará
supabase db push --linked                  # aplicarlo
```

No edites una migración ya aplicada en producción: `db push` no la vuelve a
ejecutar, así que el cambio nunca llega. Crea una migración nueva.

Para detectar cambios hechos a mano (drift), esto debe salir vacío salvo ruido
(constraints/políticas idénticas que se borran y recrean, triggers internos de storage):
```bash
supabase db diff --linked --schema public,storage
```

### Pendiente: aplicar migraciones desde el CI

Hoy ningún workflow ejecuta `supabase db push`: `.github/workflows/deploy-backend.yml` solo llama al webhook
de EasyPanel. Las migraciones se aplican a mano **antes** de mergear el PR que las necesita.

Propuesta (no implementada): un job previo al deploy del backend que ejecute `supabase db push --linked` y,
si falla, detenga el despliegue. Requiere los secretos `SUPABASE_ACCESS_TOKEN` y `SUPABASE_DB_PASSWORD`
en GitHub, y revisar con cuidado todo PR que traiga migraciones, porque se aplicarían solas en producción.

Si se coló un cambio manual: crea una migración idempotente con el SQL que
devuelve el diff (`IF NOT EXISTS`, `DROP POLICY IF EXISTS` + `CREATE POLICY`,
`ON CONFLICT DO NOTHING`) y márcala como aplicada en producción sin ejecutarla:
`supabase migration repair --status applied <version> --linked`.
Ejemplo: `20261104120000_sync_manual_db_changes.sql`.

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
v1
