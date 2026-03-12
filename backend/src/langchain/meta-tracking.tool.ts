import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export type MetaEventName = 'Contact' | 'Lead' | 'SubmitApplication' | 'HotmartLinkSent';

export interface TrackedEventConfig {
  event: MetaEventName;
  enabled: boolean;
  max_per_user: number;
  description: string;
}

/**
 * Tool DINAMICA para trackear eventos de Meta Ads
 *
 * La descripcion y eventos disponibles se construyen dinamicamente
 * basandose en la configuracion de meta_ads_config de cada agente.
 *
 * Esto permite que:
 * - Super admin habilite/deshabilite eventos por agente
 * - Cliente vea que eventos estan siendo trackeados
 * - Agente solo pueda llamar eventos habilitados
 */
export function createMetaTrackingTool(
  trackedEvents: TrackedEventConfig[], // Configuracion desde meta_ads_config
  onEventDetected: (eventName: MetaEventName, context?: string) => Promise<void>
) {
  // Filtrar solo eventos habilitados
  const enabledEvents = trackedEvents.filter(e => e.enabled);

  // Si no hay eventos habilitados, no crear la tool
  if (enabledEvents.length === 0) {
    return null;
  }

  // Construir descripcion dinamica por evento
  const eventGuides: Record<MetaEventName, string> = {
    Contact: `
📞 Contact (Max: {max}/usuario): {description}
   - DETECTADO AUTOMATICAMENTE - No llames esta tool para este evento`,

    Lead: `
🎯 Lead (Max: {max}/usuario): {description}
   ✅ Llama cuando: Usuario pregunta precios o muestra interés comercial
   ❌ No llames si: Mensaje negativo o sin interés claro`,

    SubmitApplication: `
💳 SubmitApplication (Max: {max}/usuario): {description}
   ✅ Llama cuando: Usuario confirma compra o pide proceder con pago
   ❌ No llames si: Usuario dice "lo pensaré" o no confirma`,

    HotmartLinkSent: `
🔗 HotmartLinkSent (Max: {max}/usuario): {description}
   - DETECTADO AUTOMATICAMENTE - No llames esta tool para este evento`,
  };

  // Construir descripcion completa de la tool
  const eventDescriptions = enabledEvents
    .map(evt => {
      const template = eventGuides[evt.event];
      return template
        .replace('{max}', evt.max_per_user.toString())
        .replace('{description}', evt.description);
    })
    .join('\n\n---\n');

  const fullDescription = `Registra eventos de conversión para Meta Ads.

EVENTOS HABILITADOS:
${eventDescriptions}

REGLAS:
- Confianza mínima: 70%
- Respeta límites por usuario
- NO uses si el usuario dice "no", "tal vez" o "después"`;

  // Crear enum dinamico con los eventos habilitados
  const enabledEventNames = enabledEvents.map(e => e.event);

  return new DynamicStructuredTool({
    name: 'track_meta_ads_event',
    description: fullDescription,

    schema: z.object({
      event_name: z.enum(enabledEventNames as [MetaEventName, ...MetaEventName[]]).describe(
        `Nombre del evento a registrar. Solo puedes usar: ${enabledEventNames.join(', ')}`
      ),
      confidence: z.number().min(0).max(1).optional().default(0.8).describe(
        'Confianza de la deteccion (0-1). Minimo: 0.7. Solo llama si estas seguro.'
      ),
      context: z.string().optional().describe(
        'Breve explicacion de POR QUE detectaste este evento (para debugging y auditoria)'
      ),
    }),

    func: async ({ event_name, confidence, context }) => {
      try {
        // Log para debugging
        console.log(`🎯 Meta Ads Event Detected:`);
        console.log(`   Event: ${event_name}`);
        console.log(`   Confidence: ${confidence || 0.8}`);
        console.log(`   Context: ${context || 'N/A'}`);

        // Verificar confianza minima
        const conf = confidence || 0.8;
        if (conf < 0.7) {
          return `⚠️ Confianza muy baja (${conf}). Evento NO registrado. Se requiere confianza >= 0.7`;
        }

        // Verificar que el evento esta habilitado
        const eventConfig = enabledEvents.find(e => e.event === event_name);
        if (!eventConfig) {
          return `❌ Evento "${event_name}" no esta habilitado para este agente`;
        }

        // Llamar al callback para procesar el evento
        await onEventDetected(event_name, context);

        // Retornar confirmacion al agente
        return `✅ Evento "${event_name}" registrado exitosamente para Meta Ads (confianza: ${conf})`;
      } catch (error) {
        console.error('❌ Error en track_meta_ads_event tool:', error);
        return `❌ Error al registrar evento: ${error.message}`;
      }
    },
  });
}
