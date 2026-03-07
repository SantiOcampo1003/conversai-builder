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

# Token Pricing
TOKEN_MARKUP_PERCENTAGE=100  # Markup sobre tokens de OpenAI (100 = cobrar el doble)

# Agent Execution Limits (prevenir loops infinitos y sobrecostos)
AGENT_MAX_ITERATIONS=2        # Máximo número de iteraciones con tools
AGENT_MAX_EXECUTION_TIME=30000 # Timeout en milisegundos (30s)
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
   - Decide entre chain simple o agent con tools
   - Ejecuta con OpenAI
4. ChatService guarda respuesta y descuenta tokens
5. Retorna respuesta al cliente
```

### Modules:

- **ChatModule**: Endpoint principal + orquestación
- **LangchainModule**: Lógica del agente IA
- **DatabaseModule**: Cliente Supabase (Global)
- **ConfigModule**: Variables de entorno (Global)

---

## 🤖 LangChain Agent Execution

El sistema utiliza **dos flujos diferentes** dependiendo de si el agente tiene tools configuradas o no:

### 1️⃣ **Agente CON Tools** (ReAct Agent)

Cuando el agente tiene `required_info` configurado (u otras tools en el futuro), se usa un **AgentExecutor** con loop automático:

```typescript
// Ejemplo con 1 o más tools
const tools = [];

// Tool 1: Save customer info
if (agent.required_info && agent.required_info.length > 0) {
  tools.push(createCustomerInfoTool(...));
}

// Tool 2: Check inventory (futuro)
if (agent.has_inventory) {
  tools.push(createInventoryTool(...));
}

// Tool 3: Payment links (futuro)
if (agent.payment_gateway) {
  tools.push(createPaymentTool(...));
}

// Crear agente con tools
const customAgent = createAgent({
  model,
  tools,  // Array dinámico de tools
  systemPrompt: businessInfo,
});

// Ejecutar con límite de iteraciones
const result = await customAgent.invoke({
  messages: [...messages, new HumanMessage(userMessage)],
}, {
  callbacks: [tokenCounter],
  recursionLimit: maxIterations, // ⚠️ Límite de seguridad
});
```

#### ¿Cómo funciona el loop de ReAct?

```
Iteración 1:
  Modelo → Decide llamar tool "save_customer_info"
  Tool → Guarda datos del cliente en BD

Iteración 2:
  Modelo → Recibe confirmación de la tool
  Modelo → Genera respuesta final al usuario

FIN (2 iteraciones)
```

**Límite de iteraciones (`recursionLimit`):**
- Previene loops infinitos que generan sobrecostos
- Default: `AGENT_MAX_ITERATIONS=2`
- El agente **decide dinámicamente** qué tool usar (o ninguna)

---

### 2️⃣ **Agente SIN Tools** (Chain Simple)

Cuando el agente **NO tiene tools**, se usa un chain directo:

```typescript
const prompt = ChatPromptTemplate.fromMessages([
  ['system', businessInfo],
  new MessagesPlaceholder('chat_history'),
  ['human', '{input}'],
]);

const chain = prompt.pipe(model);

const response = await chain.invoke({
  chat_history: messages,
  input: userMessage,
}, {
  callbacks: [tokenCounter],
});
```

#### ¿Por qué usar chain simple?

- **No hay loop**: Solo `prompt → modelo → respuesta`
- **Más rápido**: Menos overhead
- **Más económico**: Una sola llamada al modelo

---

### 📊 Comparación

| Característica | Chain Simple | Agent con Tools |
|---------------|--------------|-----------------|
| **Tools** | ❌ No | ✅ Sí (dinámico) |
| **Iteraciones** | 1 | 1 a N (con límite) |
| **Llamadas API** | 1 | Variable |
| **Costo** | Bajo | Variable |
| **Uso** | Conversación estándar | Tareas con acciones (guardar datos, consultar BD, etc.) |

---

## 🛡️ Protección contra Sobrecostos

### Límites configurables:

```bash
# .env
AGENT_MAX_ITERATIONS=2         # Máximo de iteraciones con tools
AGENT_MAX_EXECUTION_TIME=30000 # Timeout en ms
```

### ¿Qué pasa si se alcanza el límite?

```typescript
// Si llega a AGENT_MAX_ITERATIONS iteraciones:
// El agente retorna un mensaje de error controlado
return {
  content: 'Disculpa, estoy procesando tu solicitud pero está tomando más tiempo del esperado...',
  tokensUsed: tokenCounter.totalTokens,
};
```

### Monitoreo:

Los logs muestran las iteraciones en tiempo real:

```
🚀 Ejecutando agent con tools (max iteraciones: 2)...
🔄 Iteración 1/2
🔧 Modelo llamó a tool: save_customer_info
✅ Tool ejecutada: {"success": true}
🔄 Iteración 2/2
✅ Respuesta generada: Perfecto, he guardado tu información...
📊 Tokens totales: 1245
```

---

## 🔧 Agregar Nuevas Tools

Para agregar una nueva tool al sistema:

1. **Crear la tool** en `src/langchain/`:
```typescript
// ejemplo: inventory.tool.ts
export function createInventoryTool(db, agentId) {
  return new DynamicStructuredTool({
    name: 'check_inventory',
    description: 'Verifica disponibilidad de productos',
    schema: z.object({
      productId: z.string(),
      quantity: z.number(),
    }),
    func: async ({ productId, quantity }) => {
      // Lógica para consultar inventario
      const available = await db.checkStock(productId);
      return { available, productId, quantity };
    },
  });
}
```

2. **Agregar al agente** en `langchain.service.ts`:
```typescript
const tools = [];

// Tool existente
if (agent.required_info?.length > 0) {
  tools.push(createCustomerInfoTool(...));
}

// Nueva tool
if (agent.has_inventory) {
  tools.push(createInventoryTool(this.databaseService, agent.agent_id));
}

// El agente decide dinámicamente cuál usar
const customAgent = createAgent({
  model,
  tools, // Array dinámico
  systemPrompt: businessInfo,
});
```

3. **El modelo decide automáticamente** cuándo y cómo usar cada tool basado en el contexto de la conversación.

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
