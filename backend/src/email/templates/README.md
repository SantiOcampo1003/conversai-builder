# Email Templates - Handlebars

Este directorio contiene todos los templates de email usando **Handlebars** (.hbs).

## 📁 Estructura

```
templates/
├── layouts/
│   └── base.hbs              # Layout base (HTML wrapper)
├── partials/
│   ├── header.hbs            # Header con gradient
│   ├── footer.hbs            # Footer estándar
│   └── button.hbs            # Botón CTA reutilizable
├── invitation.hbs            # Template de invitación a equipo
├── welcome.hbs               # Template de bienvenida
└── README.md                 # Este archivo
```

## 🎨 Cómo Agregar un Nuevo Template

### 1. Crear el archivo `.hbs`

Crea un nuevo archivo en `templates/`, por ejemplo `password-reset.hbs`:

```handlebars
<tr>
  <td style="padding: 40px 30px;">

    <p style="margin: 0 0 24px 0; font-size: 16px; color: #4a4a4a; line-height: 1.6;">
      Hola <strong>{{userName}}</strong>, recibimos una solicitud para restablecer tu contraseña.
    </p>

    {{> button url=resetUrl text="Restablecer Contraseña" margin="0 0 30px 0"}}

    <p style="margin: 0; font-size: 14px; color: #6b6b6b; line-height: 1.6;">
      Este enlace expira en 1 hora.
    </p>

  </td>
</tr>
```

### 2. Registrar en `EmailService`

En `email.service.ts`, agrega el case en `getTemplateConfig()`:

```typescript
private getTemplateConfig(
  templateName: string,
  params: Record<string, any>,
): TemplateConfig | null {
  switch (templateName) {
    case 'invitation':
      // ... existing code

    case 'welcome':
      // ... existing code

    case 'password-reset':  // ← NUEVO
      return {
        subject: 'Restablecer tu contraseña',
        headerTitle: '🔐 Restablecer Contraseña',
        headerSubtitle: 'Solicitud de restablecimiento',
      };

    default:
      return null;
  }
}
```

### 3. Usar el template

```typescript
await emailService.sendTemplatedEmail(
  'usuario@ejemplo.com',
  'password-reset',
  {
    userName: 'Juan Pérez',
    resetUrl: 'https://app.com/reset?token=xyz',
  }
);
```

## 🧩 Partials Disponibles

### `{{> header}}`
Header con gradient púrpura/azul.

**Variables:**
- `headerTitle` (requerido) - Título principal
- `headerSubtitle` (opcional) - Subtítulo

### `{{> footer}}`
Footer estándar con nombre de compañía.

**Variables:**
- `footerCompany` (opcional) - Default: "easy - Agentes de IA para WhatsApp"
- `footerText` (opcional) - Default: "Si no solicitaste este correo, puedes ignorarlo."

### `{{> button}}`
Botón CTA con gradient.

**Variables:**
- `url` (requerido) - URL del enlace
- `text` (requerido) - Texto del botón
- `margin` (opcional) - Margen CSS (default: "20px 0")

**Ejemplo:**
```handlebars
{{> button url="https://example.com" text="Hacer clic aquí" margin="30px 0"}}
```

## 📝 Sintaxis Handlebars

### Variables
```handlebars
{{userName}}
{{email}}
```

### Condicionales
```handlebars
{{#if userName}}
  <p>Hola {{userName}}</p>
{{else}}
  <p>Hola usuario</p>
{{/if}}
```

### Loops
```handlebars
{{#each items}}
  <li>{{this.name}}</li>
{{/each}}
```

### Partials
```handlebars
{{> partialName}}
{{> button url=resetUrl text="Click aquí"}}
```

## 🎯 Best Practices

1. **Usa tablas para layout** - Mejor compatibilidad con clientes de email
2. **Inline CSS** - Los estilos externos no funcionan en emails
3. **Reutiliza partials** - Mantén consistencia (header, footer, button)
4. **Mantén simplicidad** - Evita JS, CSS complejo, o imágenes de fondo
5. **Prueba en múltiples clientes** - Gmail, Outlook, Apple Mail, etc.

## 🧪 Testing

Para probar un template localmente, usa el endpoint `/email/verify`:

```bash
curl -X POST http://localhost:3001/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@ejemplo.com",
    "template": "welcome",
    "params": {
      "name": "Juan",
      "email": "juan@ejemplo.com",
      "phone": "+52 123 456 7890",
      "agentId": "test-123"
    }
  }'
```

## 📚 Referencias

- [Handlebars Documentation](https://handlebarsjs.com/)
- [Email Client CSS Support](https://www.caniemail.com/)
- [Email Design Best Practices](https://templates.mailchimp.com/design/)
