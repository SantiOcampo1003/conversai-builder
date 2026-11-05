/** Estado de una instancia según Evolution (`not_found` = Evolution respondió 404). */
export type EvolutionState = 'open' | 'connecting' | 'close' | 'not_found';

/** Valores del enum `whatsapp_line_status` en la base. */
export type LineStatus = 'pending' | 'connected' | 'disconnected' | 'error';

/**
 * Traduce el estado real de Evolution al estado guardado de la línea.
 * Una línea `pending` (esperando escaneo) sigue pendiente aunque el QR haya expirado,
 * para que el usuario pueda renovarlo; una que ya estuvo conectada pasa a `disconnected`.
 */
export function mapEvolutionState(state: EvolutionState, current: LineStatus): LineStatus {
  if (state === 'open') return 'connected';
  if (state === 'not_found') return 'error';
  return current === 'pending' ? 'pending' : 'disconnected';
}

const asImage = (b64: string) => (b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`);

/** QR de la respuesta de `/instance/create` o `/instance/connect`: imagen si la hay, si no un código. */
export function extractQr(data: any): string | null {
  if (!data) return null;
  const base64 = data.qrcode?.base64 ?? data.base64;
  if (base64) return asImage(base64);
  return data.qrcode?.pairingCode ?? data.pairingCode ?? data.qrcode?.code ?? data.qr ?? data.code ?? null;
}

/** "573219385629@s.whatsapp.net" → "573219385629". */
export function phoneFromOwnerJid(jid: string | null | undefined): string | null {
  return jid ? jid.split('@')[0] : null;
}
