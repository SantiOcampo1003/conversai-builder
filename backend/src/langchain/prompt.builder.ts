import { Agent } from '../common/types/agent.types';

export function buildBusinessInfo(agent: Agent, options?: { hasMetaAds?: boolean }): string {
  // Formatear productos
  const products = agent.products
    ?.map((p) => {
      let info = `- ${p.name}: ${p.price}`;
      if (p.description) info += `\n  ${p.description}`;
      if (p.image_url) info += `\n  🖼️ Ver imagen: ${p.image_url}`;
      return info;
    })
    .join('\n\n') || 'No hay productos configurados';

  // Formatear métodos de pago
  const paymentMethods = agent.payment_methods?.join(', ') || 'No especificado';

  // Formatear FAQs
  const faqs = agent.faqs
    ?.map((f) => `P: ${f.question}\nR: ${f.answer}`)
    .join('\n\n') || 'No hay preguntas frecuentes';

  // Personalidad
  const personality = agent.agent_personality || {
    tone: 'amigable',
    formality: 'tutear',
    useEmojis: false,
  };

  const tone = personality.tone || 'amigable';
  const formality = personality.formality || 'tutear';
  const useEmojis = personality.useEmojis ? 'Usa emojis' : 'No uses emojis';

  // Precio
  const priceRange = agent.price_range
    ? `${agent.price_range.from} - ${agent.price_range.to} ${agent.price_range.currency}`
    : 'No especificado';

  // TODO: Eliminar el campo 'custom_instruction' (singular) de la BD después del deploy
  // Ya no se usa en el flujo, solo mantener por compatibilidad temporal durante migración

  // Instrucciones personalizadas con toggle (JSONB array)
  const customInstructions = agent.custom_instructions
    ? agent.custom_instructions
        .filter((item: any) => item.active) // Solo las activas
        .map((item: any, index: number) => `${index + 1}. ${item.instruction}`)
        .join('\n')
    : '';

  // Reglas internas del sistema (incluye reglas finales + restricciones)
  const internalInstructions = agent.internal_custom_instructions?.trim() || '';

  // Instrucciones sobre tools
  let toolInstructions = '';

  // Customer info tool
  if (agent.required_info && agent.required_info.length > 0) {
    toolInstructions += `\n=== HERRAMIENTA: GUARDAR INFORMACIÓN DEL CLIENTE ===
Tienes acceso a una herramienta para guardar información del cliente.
⚠️ IMPORTANTE: Usa la herramienta SOLO cuando el cliente proporcione información personal EXPLÍCITA (${agent.required_info.join(', ')}).
❌ NO uses la herramienta para saludos simples, respuestas cortas ("Sí", "No", "Ok"), preguntas del cliente, o cuando NO haya datos personales nuevos.
✅ Usa la herramienta cuando el cliente diga su nombre, email, teléfono, dirección u otra información personal.
`;
  }

  // Meta Ads tracking tool (solo si está habilitado)
  if (options?.hasMetaAds) {
    toolInstructions += `\n=== HERRAMIENTA: EVENTOS DE CONVERSIÓN META ADS ===
Tienes acceso a una herramienta para registrar eventos importantes de conversión (Lead, SubmitApplication).
⚠️ IMPORTANTE: Usa esta herramienta SOLO cuando detectes intenciones CLARAS de conversión:

✅ Cuándo usar "Lead":
- Cliente muestra interés comercial explícito: "Me interesa", "Quiero saber más", "Me gustaría cotizar"
- Cliente pregunta por precios, planes o detalles comerciales específicos
- Cliente solicita información detallada sobre un producto/servicio

✅ Cuándo usar "SubmitApplication":
- Cliente solicita avanzar con una compra: "Quiero comprarlo", "Cómo procedo con el pago"
- Cliente pide inscribirse/registrarse: "Quiero inscribirme", "Cómo me registro"
- Cliente está listo para la transacción: "Acepto", "Adelante con la compra"

❌ NO uses la herramienta para:
- Saludos simples ("Hola", "Qué tal")
- Preguntas generales sin intención de compra ("¿Qué venden?")
- Respuestas cortas ("Sí", "No", "Ok")
- Conversación casual sin interés comercial claro

NOTA: Los eventos "Contact" y "HotmartLinkSent" se detectan automáticamente, NO necesitas llamar la herramienta para ellos.
`;
  }

  return `Eres un agente de ventas por WhatsApp para ${agent.business_name}.

=== INFORMACIÓN DEL NEGOCIO ===
Tipo: ${agent.business_type}
Categoría: ${agent.business_category}
Rango de precios: ${priceRange}

=== PRODUCTOS/SERVICIOS ===
${products}

=== FORMAS DE PAGO ===
${paymentMethods}

=== PREGUNTAS FRECUENTES ===
${faqs}

=== TU PERSONALIDAD ===
- Tono: ${tone}
- Formalidad: ${formality}
- Emojis: ${useEmojis}

${customInstructions ? `=== INSTRUCCIONES PERSONALIZADAS ===\n${customInstructions}\n` : ''}
${toolInstructions}
=== REGLAS GENERALES ===
${internalInstructions}

⚠️ IMPORTANTE: El historial completo está disponible en los mensajes anteriores. Úsalo para mantener contexto sin repetir preguntas.`;
}
