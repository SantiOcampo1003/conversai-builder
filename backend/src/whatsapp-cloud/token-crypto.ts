import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const VERSION = 'v1';

/** Llave de WHATSAPP_TOKEN_ENCRYPTION_KEY (32 bytes en base64; se genera con `openssl rand -base64 32`). */
function keyFrom(base64Key: string | undefined): Buffer {
  const key = Buffer.from(base64Key ?? '', 'base64');
  if (key.length !== 32) throw new Error('WHATSAPP_TOKEN_ENCRYPTION_KEY debe ser de 32 bytes en base64 (openssl rand -base64 32)');
  return key;
}

/** Cifra el token de Meta de un cliente con AES-256-GCM: `v1:iv:tag:data` (base64). */
export function encryptToken(token: string, base64Key: string | undefined): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(base64Key), iv);
  const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

/** Descifra lo que produjo `encryptToken`; lanza si la llave no coincide o el valor fue alterado. */
export function decryptToken(encrypted: string, base64Key: string | undefined): string {
  const [version, iv, tag, data] = encrypted.split(':');
  if (version !== VERSION || !iv || !tag || !data) throw new Error('Token cifrado con formato desconocido');
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(base64Key), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
