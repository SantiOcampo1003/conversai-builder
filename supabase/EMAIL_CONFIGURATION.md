# Configuración de Email Templates

## Templates Disponibles

Este proyecto incluye templates personalizados de email con los colores y fuente de la marca:

- ✅ **confirmation.html** - Email de confirmación al registrarse
- ✅ **recovery.html** - Recuperación de contraseña
- ✅ **invite.html** - Invitación de equipo
- 🔜 **magic_link.html** - Link mágico para login (opcional)

## Variables disponibles en templates

Supabase proporciona estas variables que puedes usar en los templates:

### confirmation.html
- `{{ .ConfirmationURL }}` - URL de confirmación
- `{{ .Token }}` - Token de confirmación
- `{{ .TokenHash }}` - Hash del token
- `{{ .SiteURL }}` - URL del sitio

### invite.html
- `{{ .ConfirmationURL }}` - URL para aceptar invitación
- `{{ .Token }}` - Token de invitación
- `{{ .Data }}` - Datos adicionales del invite

### recovery.html
- `{{ .ConfirmationURL }}` - URL para resetear contraseña
- `{{ .Token }}` - Token de recuperación

## Configuración Local

Para desarrollo local, los emails NO se envían realmente. En su lugar:

1. **Inbucket** está habilitado en `config.toml` (puerto 54324)
2. Accede a `http://localhost:54324` para ver los emails enviados
3. Los emails de confirmación se envían automáticamente pero NO son bloqueantes

## Configuración en Producción (Supabase Cloud)

### Opción 1: Dashboard de Supabase (Recomendado)

1. Ve a tu proyecto en https://supabase.com/dashboard
2. Navega a **Authentication > Email Templates**
3. Edita los templates directamente en el dashboard
4. Copia el contenido de `supabase/templates/confirmation.html`

### Opción 2: CLI con archivos locales

Para usar los templates desde archivos locales en producción:

1. Los templates deben estar en el repositorio
2. Asegúrate de que el `config.toml` tenga las rutas correctas
3. Al hacer deploy, Supabase leerá los templates automáticamente

### Configurar SMTP Personalizado (Producción)

Para usar tu propio servidor SMTP (SendGrid, Mailgun, etc.):

#### SendGrid:

```toml
[auth.email.smtp]
enabled = true
host = "smtp.sendgrid.net"
port = 587
user = "apikey"
pass = "env(SENDGRID_API_KEY)"
admin_email = "noreply@easy-agents.com"
sender_name = "easy AI Agents"
```

#### Resend (Alternativa moderna):

```toml
[auth.email.smtp]
enabled = true
host = "smtp.resend.com"
port = 587
user = "resend"
pass = "env(RESEND_API_KEY)"
admin_email = "noreply@easy-agents.com"
sender_name = "easy AI Agents"
```

#### Variables de entorno:

Añade a `.env.local`:
```bash
SENDGRID_API_KEY=tu_api_key_aqui
# o
RESEND_API_KEY=tu_api_key_aqui
```

## Flujo de Confirmación de Email

### Configuración Actual (No Bloqueante)

```toml
enable_confirmations = false
```

**Comportamiento:**
- ✅ Usuario se registra → Se autentica INMEDIATAMENTE
- ✅ Puede usar la app sin restricciones
- ✅ Recibe email de confirmación
- ✅ Al confirmar, se marca `email_confirmed_at` en su perfil

**Ventajas:**
- Mejor UX, no hay fricción
- Usuario puede empezar a usar la app de inmediato

### Configuración Bloqueante (Opcional)

```toml
enable_confirmations = true
```

**Comportamiento:**
- Usuario se registra → NO se autentica
- Debe confirmar email ANTES de poder usar la app
- Solo después de confirmar puede iniciar sesión

**Cuándo usar:**
- Si necesitas validar emails reales
- Si tienes problemas de spam/bots
- Si es requerimiento legal/compliance

## Testing

### Local (Inbucket)

```bash
# Iniciar Supabase local
npx supabase start

# Ver emails en:
open http://localhost:54324
```

### Producción

1. Regístrate con un email real de prueba
2. Verifica que llegue el email
3. Confirma que el diseño se vea correcto
4. Prueba el link de confirmación

## Personalización Adicional

### Colores del Proyecto
- **Primary:** `#00D98E` (verde neón)
- **Background:** `#1a1d23` (oscuro)
- **Muted:** `#6b7280` (gris)

### Fuente
- **Inter** (cargada desde Google Fonts)
- Pesos: 400, 500, 600, 700, 800, 900

### Crear nuevos templates

1. Copia `confirmation.html` como base
2. Modifica el contenido manteniendo los colores
3. Usa las variables apropiadas de Supabase
4. Añade la configuración al `config.toml`:

```toml
[auth.email.template.recovery]
subject = "Recupera tu contraseña - easy AI Agents"
content_path = "./supabase/templates/recovery.html"
```

## Troubleshooting

### Los emails no llegan en local
- ✅ Verifica que Inbucket esté corriendo: `http://localhost:54324`
- ✅ Los emails NO se envían realmente en local

### Los templates no se ven bien
- ✅ Verifica que Google Fonts esté cargando
- ✅ Algunos clientes de email no soportan todas las CSS
- ✅ Prueba en Gmail, Outlook, Apple Mail

### El SMTP falla en producción
- ✅ Verifica las credenciales del SMTP
- ✅ Confirma que el puerto esté abierto (587 o 465)
- ✅ Revisa los logs de Supabase

## Recursos

- [Supabase Email Templates Docs](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Email Template Best Practices](https://www.campaignmonitor.com/css/)
- [SendGrid Setup](https://sendgrid.com/docs/ui/account-and-settings/api-keys/)
- [Resend Setup](https://resend.com/docs/introduction)
