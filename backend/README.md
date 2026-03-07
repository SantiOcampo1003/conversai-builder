# 🚀 ConversAI Backend

Backend modular con NestJS + LangChain para agentes conversacionales.

## 📁 Estructura

```
src/
├── main.ts                  # Entry point
├── app.module.ts            # App module
├── chat/                    # Chat module
│   ├── chat.controller.ts   # POST /api/chat/message
│   ├── chat.service.ts      # Lógica principal
│   └── dto/                 # Data Transfer Objects
├── langchain/               # LangChain module
│   ├── langchain.service.ts # Agente LangChain
│   ├── prompt.builder.ts    # Construir prompts
│   └── token.callback.ts    # Tracking de tokens
├── database/                # Database module
│   └── database.service.ts  # Supabase client
└── common/
    └── types/               # Types compartidos
```

## 🛠️ Instalación

```bash
# Instalar dependencias
npm install

# Copiar .env
cp .env.example .env

# Editar .env con tus credenciales
nano .env
```

## 🔑 Variables de Entorno

```bash
# Server
PORT=3001
NODE_ENV=development

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...

# OpenAI
OPENAI_API_KEY=sk-proj-xxx...
```

## 🚀 Ejecución

```bash
# Desarrollo
npm run start:dev

# Producción
npm run build
npm run start:prod
```

## 📡 Endpoints

### POST /api/chat/message

Envía un mensaje al agente conversacional.

**Request:**
```json
{
  "agentId": "agent_the_church_medell_n_1772677042967",
  "userId": "573007812115",
  "messageText": "Hola"
}
```

**Response:**
```json
{
  "output": "¡Hola! ¿En qué puedo ayudarte hoy? 😊"
}
```

### GET /api/chat/health

Health check del servicio.

**Response:**
```json
{
  "status": "ok",
  "service": "conversai-backend",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

## 🏗️ Arquitectura

### Flujo de un mensaje:

```
1. ChatController recibe POST /api/chat/message
2. ChatService valida y orquesta la lógica:
   - Carga agente desde Supabase
   - Verifica tokens disponibles
   - Carga historial de conversación
3. LangchainService ejecuta el agente:
   - Construye el prompt (sin historial embebido)
   - Convierte historial a formato LangChain
   - Ejecuta chain con OpenAI
4. ChatService guarda respuesta y descuenta tokens
5. Retorna respuesta al cliente
```

### Modules:

- **ChatModule**: Endpoint principal + orquestación
- **LangchainModule**: Lógica del agente IA
- **DatabaseModule**: Cliente Supabase (Global)
- **ConfigModule**: Variables de entorno (Global)

## 🎯 Próximas Features

- [ ] EmailModule (para envío de correos)
- [ ] NotificationsModule (WhatsApp, SMS)
- [ ] AnalyticsModule (métricas de uso)
- [ ] AdminModule (gestión de agentes)
- [ ] AuthModule (autenticación)

## 🔧 Agregar Nuevo Módulo

```bash
# Generar módulo con NestJS CLI
npx nest generate module email
npx nest generate service email
npx nest generate controller email

# Implementar lógica
# Importar en app.module.ts
```

## 📚 Documentación

- [NestJS Docs](https://docs.nestjs.com/)
- [LangChain Docs](https://js.langchain.com/)
- [Supabase Docs](https://supabase.com/docs)
