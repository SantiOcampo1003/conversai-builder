import { createHmac, timingSafeEqual } from 'crypto';

/** Mensaje entrante normalizado del webhook de la Cloud API de Meta. */
export interface InboundMessage {
  /** Phone Number ID de la línea que recibió el mensaje (identifica la línea en `whatsapp_lines`). */
  phoneNumberId: string;
  /** wa_id del remitente: el número en dígitos, igual que el userId que usa el flujo por QR. */
  from: string;
  messageId: string;
  type: string;
  /** Texto a pasarle al agente; null si el tipo de mensaje no se procesa. */
  text: string | null;
  profileName: string | null;
}

/**
 * Valida el header `X-Hub-Signature-256` (`sha256=<hex>`): HMAC-SHA256 del cuerpo crudo con el App Secret.
 * Sin secreto configurado siempre rechaza.
 */
export function isValidSignature(rawBody: Buffer | undefined, header: string | undefined, appSecret: string): boolean {
  if (!rawBody || !header || !appSecret || !header.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  const received = Buffer.from(header.slice('sha256='.length), 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Texto de los tipos que entiende el agente: texto libre y respuestas a botones o listas. */
function textOf(message: any): string | null {
  switch (message?.type) {
    case 'text':
      return message.text?.body ?? null;
    case 'interactive':
      return message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? null;
    case 'button':
      return message.button?.text ?? null;
    default:
      return null;
  }
}

/** Mensajes entrantes de un webhook `whatsapp_business_account`; ignora estados y otros eventos. */
export function extractInboundMessages(payload: any): InboundMessage[] {
  if (payload?.object !== 'whatsapp_business_account') return [];
  const out: InboundMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      if (change?.field !== 'messages') continue;
      const value = change.value ?? {};
      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      const names = new Map<string, string>(
        (value.contacts ?? []).map((c: any) => [c?.wa_id, c?.profile?.name] as [string, string]),
      );
      for (const message of value.messages ?? []) {
        if (!message?.from || !message?.id) continue;
        out.push({
          phoneNumberId,
          from: message.from,
          messageId: message.id,
          type: message.type ?? 'unknown',
          text: textOf(message),
          profileName: names.get(message.from) ?? null,
        });
      }
    }
  }
  return out;
}
