import { Agent, AgentAsset, DataField } from '../common/types/agent.types';
import { phoneFromContactId } from './lead-stage';
import { buildDataFieldsPrompt, hasExplicitDataFields, resolveDataFields } from './data-fields';

/** Regla por defecto para fotos de producto sin condición propia. */
export const DEFAULT_PRODUCT_PHOTO_WHEN =
  'el cliente pida ver el producto, quiera saber cómo es o muestre interés claro en comprarlo';

export const MAX_FILES_PER_REPLY = 3;

const normKey = (k: string) => k.toLowerCase().trim();

/**
 * Estado de la recogida de datos de este cliente: qué ya está guardado y qué falta.
 * Se calcula en código para que el modelo no dependa de recordar la conversación completa
 * (con historial largo olvidaba datos y cerraba antes de tiempo).
 */
export function buildLeadState(
  requiredInfo: Array<string | DataField> | null | undefined,
  leadData?: Record<string, unknown> | null,
): string {
  if (!requiredInfo || requiredInfo.length === 0) return '';

  const fields: DataField[] = requiredInfo.map((f) =>
    typeof f === 'string' ? { key: f, label: f, required: true } : f,
  );

  const saved = new Map<string, string>();
  for (const [k, v] of Object.entries(leadData ?? {})) {
    const value = typeof v === 'string' ? v.trim() : v == null ? '' : String(v);
    if (value) saved.set(normKey(k), value);
  }

  const lines = [...saved.entries()].map(([k, v]) => `- ${k}: ${v}`);
  const missing = fields.filter((f) => !saved.has(normKey(f.key)));
  const pending = missing.filter((f) => f.required !== false).map((f) => f.key);
  const optional = missing.filter((f) => f.required === false).map((f) => f.key);

  return `\n=== ESTADO DE ESTE CLIENTE (datos ya guardados) ===
Guardados:
${lines.length ? lines.join('\n') : '- (ninguno todavía)'}
Pendientes: ${pending.length ? pending.join(', ') : 'ninguno'}
${optional.length ? `Opcionales sin dato (no bloquean el cierre): ${optional.join(', ')}\n` : ''}⚠️ Toma los datos guardados como ciertos y NO los vuelvas a preguntar. Si hay datos pendientes y la persona no se ha negado a darlos, pregunta el siguiente pendiente (una pregunta por mensaje) y NO envíes todavía el mensaje de cierre.
`;
}

export function buildBusinessInfo(
  agent: Agent,
  options?: {
    hasMetaAds?: boolean;
    assets?: AgentAsset[];
    sentAssetKeys?: string[];
    /** Datos del cliente ya guardados (leads.additional_fields). */
    leadData?: Record<string, unknown> | null;
    /** Identificador de WhatsApp de la persona (número real o @lid). */
    contactId?: string;
  },
): string {
  // Fotos de producto disponibles (agent_assets con product_id)
  const photoKeysByProduct = new Map<string, string[]>();
  for (const a of options?.assets ?? []) {
    if (!a.product_id) continue;
    photoKeysByProduct.set(a.product_id, [...(photoKeysByProduct.get(a.product_id) ?? []), a.asset_key]);
  }
  const productName = (id: string) => agent.products?.find((p) => p.id === id)?.name;

  // Formatear productos
  const products = agent.products
    ?.map((p) => {
      let info = `- ${p.name}: ${p.price}`;
      if (p.description) info += `\n  ${p.description}`;
      if (p.image_url) info += `\n  🖼️ Ver imagen: ${p.image_url}`;
      const photos = p.id ? photoKeysByProduct.get(p.id) : undefined;
      if (photos?.length) info += `\n  📷 Fotos para enviar con send_file: ${photos.join(', ')}`;
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
  const dataFields = resolveDataFields(agent);
  if (dataFields.length > 0) {
    toolInstructions += `\n=== HERRAMIENTA: GUARDAR INFORMACIÓN DEL CLIENTE ===
Tienes acceso a una herramienta para guardar información del cliente.
⚠️ IMPORTANTE: Usa la herramienta SOLO cuando el cliente proporcione información personal EXPLÍCITA (${dataFields.map((f) => f.key).join(', ')}).
❌ NO uses la herramienta para saludos simples, agradecimientos, preguntas del cliente, o cuando NO haya datos nuevos.
✅ Las respuestas cortas SÍ se guardan cuando contestan la pregunta de un dato que acabas de hacer (ej. "b1", "tarde", "sí, este mismo número"): guárdalas en el campo de esa pregunta. Si un dato se completa en varios mensajes, guarda el valor completo.
✅ Usa la herramienta cuando el cliente diga su nombre, email, teléfono, dirección u otra información personal.
`;
    // Agentes con datos definidos en el formato nuevo: se listan con su clave y qué va en cada uno
    if (hasExplicitDataFields(agent)) toolInstructions += buildDataFieldsPrompt(dataFields);
  }

  // Archivos que el agente puede enviar (imágenes y PDFs)
  if (options?.assets && options.assets.length > 0) {
    const list = options.assets
      .map((a) => {
        const tipo = a.kind === 'image' ? 'imagen' : 'PDF';
        const producto = a.product_id ? ` (foto de ${productName(a.product_id) ?? 'un producto'})` : '';
        const cuando = a.send_when?.trim() || DEFAULT_PRODUCT_PHOTO_WHEN;
        return `- ${a.asset_key} [${tipo}]${producto}: ${a.title}\n  Enviar cuando: ${cuando}`;
      })
      .join('\n');
    const sent = options.sentAssetKeys?.length
      ? `\nYa enviados a este cliente (NO los repitas): ${options.sentAssetKeys.join(', ')}`
      : '';
    toolInstructions += `\n=== ARCHIVOS DISPONIBLES ===
Tienes la herramienta send_file para enviar estos archivos al cliente. Usa SIEMPRE la clave exacta de la lista (el texto antes de los dos puntos):
${list}${sent}
⚠️ Cuando la condición "Enviar cuando" de un archivo se cumpla y no esté en "Ya enviados", DEBES llamar a send_file en esa misma respuesta. Úsala SOLO cuando se cumpla la condición "Enviar cuando" (máximo ${MAX_FILES_PER_REPLY} archivos por respuesta). El archivo llega junto con tu respuesta: no pegues enlaces ni digas que "adjuntas" algo que no enviaste con la herramienta. Escribe además un mensaje breve que lo acompañe.
`;
  }

  // Meta Ads tracking tool (solo si está habilitado)
  if (options?.hasMetaAds) {
    toolInstructions += `\n=== EVENTOS DE CONVERSIÓN ===
Usa la herramienta de eventos cuando:
✅ "Lead": Cliente pregunta precios o muestra interés comercial
✅ "SubmitApplication": Cliente confirma compra o solicita proceder con pago
❌ NO uses para saludos, preguntas generales o respuestas cortas
`;
  }

  const contactPhone = phoneFromContactId(options?.contactId);
  const phoneNote =
    dataFields.length === 0 || !options?.contactId
      ? ''
      : contactPhone
        ? `Número de WhatsApp de esta persona: +${contactPhone}. Ya lo tienes: NO se lo pidas. Si necesitas su teléfono para la llamada, solo confirma que sea ese mismo número.\n`
        : 'El número de teléfono de esta persona NO está disponible (WhatsApp lo oculta). Si hace falta para la llamada, pídeselo.\n';
  const leadState = buildLeadState(dataFields, options?.leadData) + (phoneNote ? `\n${phoneNote}` : '');

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
${toolInstructions}${leadState}
=== REGLAS GENERALES ===
${internalInstructions}

⚠️ IMPORTANTE: El historial completo está disponible en los mensajes anteriores. Úsalo para mantener contexto sin repetir preguntas.`;
}
