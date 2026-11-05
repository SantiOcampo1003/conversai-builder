import { createHmac } from 'crypto';
import { extractInboundMessages, isValidSignature } from './webhook-payload';

const SECRET = 'app-secret';
const sign = (body: string, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

describe('isValidSignature', () => {
  const body = '{"object":"whatsapp_business_account"}';

  it('acepta la firma HMAC-SHA256 del cuerpo crudo con el App Secret', () => {
    expect(isValidSignature(Buffer.from(body), sign(body), SECRET)).toBe(true);
  });
  it('rechaza una firma hecha con otro secreto', () => {
    expect(isValidSignature(Buffer.from(body), sign(body, 'otro'), SECRET)).toBe(false);
  });
  it('rechaza si el cuerpo cambió', () => {
    expect(isValidSignature(Buffer.from(body + ' '), sign(body), SECRET)).toBe(false);
  });
  it('rechaza sin header, sin cuerpo o sin secreto configurado', () => {
    expect(isValidSignature(Buffer.from(body), undefined, SECRET)).toBe(false);
    expect(isValidSignature(undefined, sign(body), SECRET)).toBe(false);
    expect(isValidSignature(Buffer.from(body), sign(body), '')).toBe(false);
  });
  it('rechaza un header mal formado sin lanzar excepción', () => {
    expect(isValidSignature(Buffer.from(body), 'sha256=zz', SECRET)).toBe(false);
  });
});

const payload = (messages: any[], extra: any = {}) => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'WABA1',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '15551571956', phone_number_id: 'PN1' },
            contacts: [{ profile: { name: 'Ana' }, wa_id: '573001112233' }],
            messages,
            ...extra,
          },
        },
      ],
    },
  ],
});

describe('extractInboundMessages', () => {
  it('lee un texto con el número de destino, el remitente y el nombre de perfil', () => {
    const msgs = extractInboundMessages(
      payload([{ from: '573001112233', id: 'wamid.1', timestamp: '1', type: 'text', text: { body: 'Hola' } }]),
    );
    expect(msgs).toEqual([
      { phoneNumberId: 'PN1', from: '573001112233', messageId: 'wamid.1', type: 'text', text: 'Hola', mediaId: null, profileName: 'Ana' },
    ]);
  });

  it('usa el título de la opción elegida en botones y listas', () => {
    const msgs = extractInboundMessages(
      payload([
        { from: '57300', id: 'a', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'x', title: 'Sí' } } },
        { from: '57300', id: 'b', type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'y', title: 'Plan Pro' } } },
        { from: '57300', id: 'c', type: 'button', button: { text: 'Quiero más info', payload: 'p' } },
      ]),
    );
    expect(msgs.map((m) => m.text)).toEqual(['Sí', 'Plan Pro', 'Quiero más info']);
  });

  it('marca sin texto los tipos que no son texto y guarda el ID del audio para transcribirlo', () => {
    const msgs = extractInboundMessages(
      payload([
        { from: '57300', id: 'a', type: 'audio', audio: { id: 'm1' } },
        { from: '57300', id: 'b', type: 'reaction', reaction: { emoji: '🙏' } },
      ]),
    );
    expect(msgs.map((m) => [m.type, m.text, m.mediaId])).toEqual([
      ['audio', null, 'm1'],
      ['reaction', null, null],
    ]);
  });

  it('ignora eventos de estado (entregado/leído) y otros campos', () => {
    const statusOnly = payload([], { statuses: [{ id: 'wamid.1', status: 'delivered' }] });
    delete (statusOnly.entry[0].changes[0].value as any).messages;
    expect(extractInboundMessages(statusOnly)).toEqual([]);
    expect(extractInboundMessages({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'account_update', value: {} }] }] })).toEqual([]);
  });

  it('tolera cuerpos inesperados', () => {
    expect(extractInboundMessages(null)).toEqual([]);
    expect(extractInboundMessages({ object: 'page' })).toEqual([]);
  });
});
