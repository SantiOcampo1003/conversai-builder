# N8N Webhook Setup - ConversAI

Este workflow maneja tanto leads de contacto como invitaciones de usuarios a equipos.

## Configuración del Workflow en n8n

### 1. Importar el Workflow

1. Abre tu instancia de n8n
2. Click en "Workflows" → "Import from File"
3. Selecciona el archivo `conversai-webhook-handler.json`
4. El workflow se importará con todos los nodos configurados

### 2. Configurar Credenciales de Gmail

1. En el nodo "Gmail - Send Lead":
   - Click en "Credentials" → "Create New"
   - Selecciona "Gmail OAuth2"
   - Sigue el proceso de autenticación con tu cuenta de Gmail
   - Guarda las credenciales

2. En el nodo "Gmail - Send Invite":
   - Usa las mismas credenciales de Gmail que creaste
   - Asegúrate de que ambos nodos apunten a la misma credencial

### 3. Activar el Workflow

1. Click en "Active" en la esquina superior derecha
2. Copia la URL del webhook que aparece en el nodo "Webhook"
3. La URL será algo como: `https://tu-n8n.com/webhook/conversai-webhook`

### 4. Configurar Variables de Entorno en la App

En tu archivo `.env.local` (en la raíz del proyecto React), agrega:

```env
VITE_N8N_INVITE_WEBHOOK=https://tu-n8n.com/webhook/conversai-webhook
```

**IMPORTANTE:** Reemplaza `https://tu-n8n.com/webhook/conversai-webhook` con la URL real de tu webhook de n8n.

## Cómo Funciona el Workflow

### Para Contact Leads (existente)

Cuando se envía un formulario de contacto, la app envía:

```json
{
  "type": "contact-lead",
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "phone": "+57 300 123 4567",
  "message": "Me interesa saber más sobre ConversAI"
}
```

El workflow:
1. Recibe el webhook
2. Identifica que es tipo "contact-lead"
3. Envía un email a `julianocampo@gmail.com` con los datos del lead
4. Responde con éxito

### Para User Invites (nuevo)

Cuando un admin invita a un miembro, la app envía:

```json
{
  "type": "user-invite",
  "email": "nuevo@example.com",
  "role": "billing",
  "inviteUrl": "https://tuapp.com/accept-invite?token=xxx-xxx-xxx",
  "invitedBy": "admin@example.com"
}
```

El workflow:
1. Recibe el webhook
2. Identifica que es tipo "user-invite"
3. Envía un email al usuario invitado con el link de invitación
4. Responde con éxito

## Estructura del Workflow

```
Webhook (POST)
    ↓
Switch by Type
    ├─→ [contact-lead] → Gmail Send Lead → Response Success
    ├─→ [user-invite]  → Gmail Send Invite → Response Success
    └─→ [invalid]      → Response Error
```

## Personalización de Emails

### Email de Lead

Para modificar el email que recibes cuando hay un nuevo lead:
- Edita el nodo "Gmail - Send Lead"
- Modifica el HTML en el campo "message"
- Cambia el destinatario en "sendTo" si quieres recibirlo en otro email

### Email de Invitación

Para modificar el email que reciben los usuarios invitados:
- Edita el nodo "Gmail - Send Invite"
- Modifica el HTML en el campo "message"
- Los datos se insertan con sintaxis `{{$json.body.campo}}`

## Seguridad

- El webhook está público pero solo responde a POST requests con el formato correcto
- Los tokens de invitación son UUIDs únicos y se validan en la base de datos
- Los tokens solo funcionan una vez (status cambia de 'pending' a 'active')
- Los emails de invitación se envían solo a la dirección especificada en la invitación

## Testing

### Probar Contact Lead

Puedes probar el webhook con curl:

```bash
curl -X POST https://tu-n8n.com/webhook/conversai-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "contact-lead",
    "name": "Test User",
    "email": "test@example.com",
    "phone": "+57 300 123 4567",
    "message": "Este es un mensaje de prueba"
  }'
```

### Probar User Invite

```bash
curl -X POST https://tu-n8n.com/webhook/conversai-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "user-invite",
    "email": "test@example.com",
    "role": "billing",
    "inviteUrl": "https://localhost:5173/accept-invite?token=test-token",
    "invitedBy": "Admin"
  }'
```

## Troubleshooting

### El webhook no responde

- Verifica que el workflow esté "Active" en n8n
- Revisa los logs en n8n para ver si hay errores
- Confirma que la URL del webhook sea correcta en `.env.local`

### No llegan los emails

- Verifica las credenciales de Gmail en n8n
- Revisa la carpeta de spam
- Chequea los logs del nodo Gmail en n8n para ver errores de envío
- Asegúrate de que la cuenta de Gmail tenga habilitado el acceso a aplicaciones menos seguras

### Error 400 "Invalid request type"

- El campo `type` debe ser exactamente "contact-lead" o "user-invite"
- Verifica que el JSON esté bien formado
- Revisa que todos los campos requeridos estén presentes

## Notas Adicionales

- El mismo webhook maneja ambos tipos de emails, diferenciándolos por el campo `type`
- Los emails están diseñados con HTML responsive y funcionan en todos los clientes de email
- Puedes agregar más tipos de emails en el futuro agregando más casos al nodo "Switch by Type"
