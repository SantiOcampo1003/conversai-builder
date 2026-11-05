import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe';

/**
 * Extensión que la API de transcripción de OpenAI reconoce para cada tipo de audio de WhatsApp.
 * WhatsApp también admite audio/aac y audio/amr, que OpenAI no acepta.
 */
const EXTENSIONS: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/flac': 'flac',
};

/** "audio/ogg; codecs=opus" → "ogg"; null si el formato no se puede transcribir. */
export function audioExtension(mimeType: string): string | null {
  return EXTENSIONS[mimeType.split(';')[0].trim().toLowerCase()] ?? null;
}

/** Notas de voz a texto con la API de transcripción de OpenAI (misma OPENAI_API_KEY de los agentes). */
@Injectable()
export class AudioTranscriber {
  constructor(private readonly config: ConfigService) {}

  /** Texto del audio ('' si no se dijo nada). Lanza si el formato no se admite o OpenAI falla. */
  async transcribe(data: Buffer, mimeType: string): Promise<string> {
    const ext = audioExtension(mimeType);
    if (!ext) throw new Error(`Formato de audio no admitido: ${mimeType || 'desconocido'}`);
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new Error('Falta configurar OPENAI_API_KEY en el servidor');

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(data)], { type: mimeType }), `audio.${ext}`);
    form.append('model', this.config.get<string>('OPENAI_TRANSCRIBE_MODEL') || DEFAULT_TRANSCRIBE_MODEL);
    form.append('response_format', 'json');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(60000),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`OpenAI respondió ${res.status} al transcribir: ${body.slice(0, 200)}`);
    return String(JSON.parse(body)?.text ?? '').trim();
  }
}
