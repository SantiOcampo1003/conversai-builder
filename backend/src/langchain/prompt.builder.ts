import { Agent } from '../common/types/agent.types';

export function buildBusinessInfo(agent: Agent): string {
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

  // Instrucciones sobre tools (si tiene required_info configurado)
  const toolInstructions = agent.required_info && agent.required_info.length > 0
    ? `\n=== USO DE HERRAMIENTAS ===
Tienes acceso a una herramienta para guardar información del cliente.
⚠️ IMPORTANTE: Usa la herramienta SOLO cuando el cliente proporcione información personal EXPLÍCITA (${agent.required_info.join(', ')}).
❌ NO uses la herramienta para saludos simples, respuestas cortas ("Sí", "No", "Ok"), preguntas del cliente, o cuando NO haya datos personales nuevos.
✅ Usa la herramienta cuando el cliente diga su nombre, email, teléfono, dirección u otra información personal.
`
    : '';

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
