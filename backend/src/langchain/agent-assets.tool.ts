import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { DatabaseService } from '../database/database.service';
import { AgentAsset, OutboundFile } from '../common/types/agent.types';
import { MAX_FILES_PER_REPLY } from './prompt.builder';

/**
 * Herramienta para que el agente decida enviar un archivo (imagen o PDF) al cliente.
 *
 * No envía nada por sí misma: valida la clave contra los archivos del agente, evita repetir
 * un archivo ya enviado en esta conversación y lo agrega a `outbox`. El canal (workflow de
 * WhatsApp en n8n) envía el contenido de `outbox` después del texto de la respuesta.
 */
export function createSendFileTool(
  databaseService: DatabaseService,
  agentId: string,
  userId: string,
  assets: AgentAsset[],
  alreadySent: Set<string>,
  outbox: OutboundFile[],
) {
  const byKey = new Map(assets.map((a) => [a.asset_key, a]));
  const keys = assets.map((a) => a.asset_key) as [string, ...string[]];

  return new DynamicStructuredTool({
    name: 'send_file',
    description: `Envía al cliente un archivo (imagen o PDF) de la lista "ARCHIVOS DISPONIBLES".
Úsala SOLO cuando se cumpla la condición "enviar cuando" del archivo. No la uses para archivos que no estén en la lista.
Claves válidas: ${keys.join(', ')}.
El archivo llega al cliente junto con tu respuesta de texto: no pegues enlaces en el mensaje.`,
    schema: z.object({
      asset_key: z.enum(keys).describe('Clave del archivo a enviar'),
    }),
    func: async ({ asset_key }: { asset_key: string }) => {
      const asset = byKey.get(asset_key);
      if (!asset) {
        return `La clave "${asset_key}" no existe. No envíes nada.`;
      }
      if (outbox.length >= MAX_FILES_PER_REPLY) {
        return `Ya se enviaron ${MAX_FILES_PER_REPLY} archivos en esta respuesta (el máximo). No envíes más; ofrece enviar el resto si el cliente lo pide.`;
      }
      if (alreadySent.has(asset_key)) {
        return `El archivo "${asset.title}" ya se le envió a este cliente antes. No lo vuelvas a enviar; si hace falta, menciónalo en tu respuesta.`;
      }

      outbox.push({
        assetKey: asset.asset_key,
        type: asset.kind,
        url: asset.public_url,
        fileName: asset.file_name,
        mimetype: asset.mime_type,
        caption: asset.caption,
      });
      alreadySent.add(asset_key);

      try {
        const { error } = await databaseService
          .getAdminClient()
          .from('agent_asset_sends')
          .insert({ agent_id: agentId, user_id: userId, asset_key });
        if (error) console.error('❌ Error registrando envío de archivo:', error);
      } catch (err) {
        console.error('❌ Error registrando envío de archivo:', err);
      }

      return `Listo: "${asset.title}" se enviará al cliente junto con tu respuesta. No pegues el enlace en el mensaje.`;
    },
  });
}
