import { OutboundFile } from '../../common/types/agent.types';

export class ChatResponseDto {
  output: string;

  /** Archivos a enviar después del texto (solo si el agente decidió enviarlos). */
  files?: OutboundFile[];
}
