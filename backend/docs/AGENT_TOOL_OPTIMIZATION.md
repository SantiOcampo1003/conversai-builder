# 🔧 Optimización de Tool Calling en Agentes

## 📊 Cómo Funciona Actualmente

El agente utiliza el patrón **ReAct** (Reasoning + Acting) que ejecuta en un **loop iterativo**:

```
Iteración 1:
  User: "Hola, soy Juan, mi email es juan@test.com"
  Modelo → Analiza mensaje
  Modelo → Decide llamar tool "save_customer_info"
  Tool → Ejecuta y guarda en BD

Iteración 2:
  Tool → Retorna {"success": true, "saved": ["nombre", "email"]}
  Modelo → Analiza respuesta de la tool
  Modelo → Genera respuesta final
  Output: "¡Perfecto Juan! He guardado tu información..."

TOTAL: 2 iteraciones (mínimo)
```

### ⚠️ Problema: Múltiples Iteraciones Innecesarias

Si el modelo decide hacer llamadas secuenciales:

```
Iteración 1: Modelo → "Voy a guardar el nombre"
Iteración 2: Llama save_customer_info(nombre="Juan")
Iteración 3: Modelo → "Ahora voy a guardar el email"
Iteración 4: Llama save_customer_info(email="juan@test.com")
Iteración 5: Genera respuesta final

TOTAL: 5 iteraciones ❌ (costoso y lento)
```

---

## ✅ Solución Implementada: Parallel Tool Calling

### ¿Qué es Parallel Tool Calling?

Permite que el modelo llame **múltiples tools en paralelo** en una sola iteración:

```typescript
// langchain.service.ts (líneas 48-60)
const model = new ChatOpenAI({
  modelName: agent.model || 'gpt-4-turbo',
  temperature: agent.temperature ?? 0.7,
  maxTokens: agent.max_tokens ?? 500,
  openAIApiKey: this.configService.get<string>('OPENAI_API_KEY'),
  // ✅ Habilitar llamadas paralelas a tools
  modelKwargs: {
    parallel_tool_calls: true,
  },
});
```

### Flujo Optimizado:

```
Iteración 1:
  User: "Hola, soy Juan, email juan@test.com, teléfono 123456"
  Modelo → Llama TODAS las tools necesarias en paralelo:
    - save_customer_info(nombre="Juan", email="juan@test.com", telefono="123456")
  Tool → Ejecuta

Iteración 2:
  Tool → Retorna resultado
  Modelo → Genera respuesta final

TOTAL: 2 iteraciones ✅ (óptimo)
```

---

## 🎯 Modelos Compatibles

### ✅ Soportan `parallel_tool_calls`:
- **gpt-4-turbo** (Recomendado)
- **gpt-4o**
- **gpt-3.5-turbo** (Noviembre 2023+)

### ❌ NO soportan:
- gpt-3.5-turbo (versiones antiguas)
- gpt-4 (base)

---

## 📈 Beneficios

| Aspecto | Sin Parallel | Con Parallel |
|---------|-------------|--------------|
| **Iteraciones** | 3-5+ | 2 (óptimo) |
| **Tiempo** | ~5-10s | ~2-3s |
| **Costo tokens** | Alto | Reducido 40-60% |
| **Experiencia UX** | Lenta | Rápida |

---

## 🔍 Monitoreo

Los logs ahora muestran:

```bash
🚀 Ejecutando agent con tools (max iteraciones: 2, parallel_tool_calls: enabled)...
✅ Respuesta generada: ¡Perfecto Juan! He guardado...
📊 Tokens totales: 1245
🔧 Tool calls ejecutadas: 1 en 1 iteraciones
```

**Interpretación:**
- `Tool calls ejecutadas: 1` → 1 llamada a tool
- `en 1 iteraciones` → Se hizo en 1 sola iteración (óptimo)

---

## 🛡️ Protección con Límites

Incluso con parallel tool calling, mantenemos límites de seguridad:

```bash
# .env
AGENT_MAX_ITERATIONS=2  # Máximo 2 iteraciones
```

**¿Por qué 2 iteraciones es suficiente?**

Con parallel tool calling:
- **Iteración 1**: Llamadas a todas las tools necesarias
- **Iteración 2**: Generación de respuesta final

Si se alcanza el límite, el agente retorna un mensaje controlado.

---

## 🔧 Configuración por Modelo

Si necesitas usar modelos diferentes:

```typescript
// Para modelos SIN parallel tool calling:
const model = new ChatOpenAI({
  modelName: 'gpt-4', // Modelo antiguo
  // NO incluir parallel_tool_calls
});

// Para modelos CON parallel tool calling:
const model = new ChatOpenAI({
  modelName: 'gpt-4-turbo',
  modelKwargs: {
    parallel_tool_calls: true, // ✅ Habilitar
  },
});
```

---

## 📊 Comparación de Escenarios

### Escenario 1: Usuario da toda la información junta

**Input:**
> "Hola, soy Juan Pérez, mi email es juan@test.com y mi teléfono es 123456789"

**Con Parallel Tool Calling:**
```
Iteración 1: Llama save_customer_info(nombre, email, telefono)
Iteración 2: Respuesta final
TOTAL: 2 iteraciones ✅
```

**Sin Parallel Tool Calling:**
```
Iteración 1: Llama save_customer_info(nombre)
Iteración 2: Analiza
Iteración 3: Llama save_customer_info(email)
Iteración 4: Analiza
Iteración 5: Llama save_customer_info(telefono)
Iteración 6: Respuesta final
TOTAL: 6 iteraciones ❌
```

### Escenario 2: Usuario da información por partes

**Input Chat 1:**
> "Hola, soy Juan"

**Input Chat 2:**
> "Mi email es juan@test.com"

**Con/Sin Parallel Tool Calling:**
```
Chat 1:
  Iteración 1: Llama save_customer_info(nombre)
  Iteración 2: Respuesta

Chat 2:
  Iteración 1: Llama save_customer_info(email)
  Iteración 2: Respuesta

TOTAL: 2 chats, 4 iteraciones totales ✅
```

En este caso, parallel tool calling **NO afecta** porque cada chat es independiente.

---

## 💡 Mejores Prácticas

### 1. **Usar prompts que incentiven información completa:**

```typescript
// En prompt.builder.ts
const systemPrompt = `
...
Si el usuario proporciona varios datos a la vez (nombre, email, teléfono),
guárdalos todos en una sola llamada a la herramienta.
...
`;
```

### 2. **Configurar maxIterations apropiadamente:**

```bash
# Para agentes con 1 tool simple
AGENT_MAX_ITERATIONS=2

# Para agentes con múltiples tools complejas
AGENT_MAX_ITERATIONS=3-4
```

### 3. **Monitorear logs en producción:**

Revisar periódicamente:
- Promedio de iteraciones por conversación
- Cuántas veces se alcanza el límite
- Distribución de tool calls

---

## 🚀 Escalabilidad

Cuando agregues más tools:

```typescript
const tools = [];

// Tool 1: Customer info
if (agent.required_info?.length > 0) {
  tools.push(createCustomerInfoTool(...));
}

// Tool 2: Inventory check
if (agent.has_inventory) {
  tools.push(createInventoryTool(...));
}

// Tool 3: Payment link
if (agent.payment_gateway) {
  tools.push(createPaymentTool(...));
}

// El modelo puede llamar múltiples tools en paralelo
const customAgent = createAgent({
  model, // con parallel_tool_calls: true
  tools, // Array dinámico
  systemPrompt,
});
```

**Con parallel tool calling**, si un usuario dice:
> "Verifica si tienes stock de producto X y genera un link de pago"

El modelo puede:
```
Iteración 1:
  - Llama check_inventory(productId="X")
  - Llama create_payment_link(product="X", amount=100)
  (en paralelo)

Iteración 2:
  Respuesta final con ambos resultados

TOTAL: 2 iteraciones ✅
```

---

## 📚 Referencias

- [OpenAI Parallel Function Calling](https://platform.openai.com/docs/guides/function-calling/parallel-function-calling)
- [LangChain Agent Documentation](https://js.langchain.com/docs/modules/agents/)
- [ReAct Pattern Paper](https://arxiv.org/abs/2210.03629)
