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
📞 **Event: "Contact"** (Max: {max}/usuario)
   Descripcion: {description}

   ✅ Llama cuando:
   - Es el PRIMER mensaje del usuario en esta conversacion
   - Usuario inicia contacto (puede ser despues de ver un anuncio)

   Ejemplos:
   ✅ "Hola, vi tu anuncio en Facebook"
   ✅ "Buenos dias, me interesa tu servicio"
   ✅ "Hola" (si es el primer mensaje)

   ❌ NO llames si:
   - Ya registraste Contact anteriormente
   - No es el primer mensaje del usuario`,

    Lead: `
🎯 **Event: "Lead"** (Max: {max}/usuario)
   Descripcion: {description}

   ✅ Llama cuando:
   - Usuario pregunta por precio, costo, caracteristicas
   - Solicita informacion detallada del producto/servicio
   - Muestra interes comercial claro

   Ejemplos:
   ✅ "¿Cuanto cuesta el curso?"
   ✅ "Me interesa, dime mas"
   ✅ "¿Que incluye el paquete?"
   ✅ "Quiero informacion sobre..."

   ❌ NO llames si:
   - "Tal vez me interese" (dudoso)
   - "No me interesa" (negativo)
   - Solo pregunta algo general`,

    SubmitApplication: `
💳 **Event: "SubmitApplication"** (Max: {max}/usuario)
   Descripcion: {description}

   ✅ Llama cuando:
   - Usuario CONFIRMA que quiere comprar/adquirir
   - Solicita link de pago o como proceder
   - Dice explicitamente "si quiero", "adelante", "proceder"

   Ejemplos:
   ✅ "Si, quiero comprarlo"
   ✅ "Dame el link de pago"
   ✅ "¿Como procedo con la compra?"
   ✅ "Confirmo, adelante"

   ❌ NO llames si:
   - "Lo voy a pensar" (no confirma)
   - "Tal vez despues" (no confirma)
   - Solo pregunta como comprar (usa Lead en ese caso)`,

    HotmartLinkSent: `
🔗 **Event: "HotmartLinkSent"** (Max: {max}/usuario)
   Descripcion: {description}

   ✅ Llama cuando:
   - VAS A INCLUIR un enlace de Hotmart/Eduzz en TU respuesta
   - Compartes link de pago con el usuario

   Ejemplos:
   ✅ Cuando escribes: "Aqui el link: hotmart.com/curso-python"
   ✅ Cuando incluyes: "Paga aqui: pay.hotmart.com/..."

   ❌ NO llames si:
   - Solo mencionas que existe un link (sin enviarlo)
   - Usuario te pregunta por el link (pero no lo envias aun)`,
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

  const fullDescription = `Registra eventos de conversion para optimizar campañas publicitarias de Meta Ads.

⚠️ EVENTOS HABILITADOS PARA ESTE AGENTE:

${eventDescriptions}

---

📋 REGLAS GENERALES:
1. Llama esta herramienta ANTES de enviar tu respuesta al usuario
2. Solo puedes usar eventos de la lista de arriba (los habilitados)
3. Confianza minima: 0.7 (70%) - Si no estas seguro, NO llames
4. Respeta los limites maximos por usuario
5. Usa "context" para explicar brevemente POR QUE detectaste este evento

❌ NUNCA USES ESTA HERRAMIENTA SI:
- El evento no esta en la lista de habilitados arriba
- Tu confianza es menor a 0.7
- El usuario dice "no", "tal vez", "despues"
- Ya se alcanzo el maximo de envios para ese evento`;

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
