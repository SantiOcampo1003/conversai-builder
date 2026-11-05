import { BadGatewayException, ForbiddenException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { WhatsAppCloudClient } from './whatsapp-cloud.client';
import { WhatsAppCloudController } from './whatsapp-cloud.controller';
import { UNSUPPORTED_MESSAGE, WhatsAppCloudService } from './whatsapp-cloud.service';

const env: Record<string, string> = {
  WHATSAPP_ACCESS_TOKEN: 'tok',
  META_GRAPH_VERSION: 'v25.0',
  META_APP_SECRET: 'secret',
  WHATSAPP_VERIFY_TOKEN: 'verify-me',
};
const config = { get: (k: string) => env[k] } as any;

describe('WhatsAppCloudClient', () => {
  afterEach(() => jest.restoreAllMocks());
  const ok = () =>
    jest.spyOn(global, 'fetch').mockImplementation(async () => new Response('{"messages":[{"id":"wamid.x"}]}', { status: 200 }));

  it('envía texto al endpoint /{phone_number_id}/messages con el token Bearer', async () => {
    const fetchMock = ok();
    await new WhatsAppCloudClient(config).sendText('PN1', '573001112233', 'Hola');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v25.0/PN1/messages');
    expect((init.headers as any).Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '573001112233',
      type: 'text',
      text: { body: 'Hola', preview_url: false },
    });
  });

  it('envía imágenes y documentos por link con su caption y nombre', async () => {
    const fetchMock = ok();
    const client = new WhatsAppCloudClient(config);
    await client.sendFile('PN1', '57300', { assetKey: 'a', type: 'image', url: 'https://x/i.jpg', fileName: null, mimetype: null, caption: 'Foto' });
    await client.sendFile('PN1', '57300', { assetKey: 'b', type: 'document', url: 'https://x/d.pdf', fileName: 'menu.pdf', mimetype: null, caption: null });
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string));
    expect(bodies[0]).toMatchObject({ type: 'image', image: { link: 'https://x/i.jpg', caption: 'Foto' } });
    expect(bodies[1]).toMatchObject({ type: 'document', document: { link: 'https://x/d.pdf', filename: 'menu.pdf' } });
  });

  it('un error de Graph sale como 502 con el mensaje de Meta', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response('{"error":{"message":"(#131047) Re-engagement message","code":131047}}', { status: 400 }),
    );
    await expect(new WhatsAppCloudClient(config).sendText('PN1', '57300', 'x')).rejects.toThrow(BadGatewayException);
    await expect(new WhatsAppCloudClient(config).sendText('PN1', '57300', 'x')).rejects.toThrow(/131047/);
  });

  it('sin token configurado no llama a Meta', async () => {
    const fetchMock = ok();
    await expect(new WhatsAppCloudClient({ get: () => undefined } as any).sendText('PN1', '57300', 'x')).rejects.toThrow(
      /WHATSAPP_ACCESS_TOKEN/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/** Base falsa: la tabla whatsapp_lines devuelve la línea indicada al buscar por meta_phone_number_id. */
function makeDb(line: any) {
  const from = () => {
    const filters: Record<string, any> = {};
    const b: any = {
      select: () => b,
      eq: (k: string, v: any) => ((filters[k] = v), b),
      maybeSingle: async () => ({
        data: line && filters.meta_phone_number_id === line.meta_phone_number_id && filters.provider === 'meta_cloud' ? line : null,
        error: null,
      }),
    };
    return b;
  };
  return { getAdminClient: () => ({ from }) } as any;
}

const webhook = (msg: any, phoneNumberId = 'PN1') => ({
  object: 'whatsapp_business_account',
  entry: [{ id: 'W', changes: [{ field: 'messages', value: { metadata: { phone_number_id: phoneNumberId }, contacts: [], messages: [msg] } }] }],
});
const text = (body: string, id = 'wamid.1') => ({ from: '573001112233', id, type: 'text', text: { body } });

function setup(line: any = { meta_phone_number_id: 'PN1', agent_id: 'agent_1' }, reply: any = { output: 'Hola, ¿en qué te ayudo?' }) {
  const chat = { handleMessage: jest.fn(async () => reply) } as any;
  const client = { sendText: jest.fn(async () => undefined), sendFile: jest.fn(async () => undefined), markRead: jest.fn(async () => undefined) } as any;
  return { svc: new WhatsAppCloudService(makeDb(line), chat, client), chat, client };
}

describe('WhatsAppCloudService.handleWebhook', () => {
  it('pasa el texto al agente de la línea y responde por la misma línea', async () => {
    const { svc, chat, client } = setup();
    await svc.handleWebhook(webhook(text('Hola')));
    expect(chat.handleMessage).toHaveBeenCalledWith({ agentId: 'agent_1', userId: '573001112233', messageText: 'Hola' });
    expect(client.sendText).toHaveBeenCalledWith('PN1', '573001112233', 'Hola, ¿en qué te ayudo?');
  });

  it('envía los archivos que decidió el agente después del texto', async () => {
    const file = { assetKey: 'menu', type: 'document', url: 'https://x/m.pdf', fileName: 'm.pdf', mimetype: null, caption: null };
    const { svc, client } = setup(undefined, { output: 'Te envío el menú', files: [file] });
    await svc.handleWebhook(webhook(text('menú')));
    expect(client.sendText).toHaveBeenCalledTimes(1);
    expect(client.sendFile).toHaveBeenCalledWith('PN1', '573001112233', file);
  });

  it('procesa una sola vez un mensaje que Meta reenvía', async () => {
    const { svc, chat } = setup();
    await svc.handleWebhook(webhook(text('Hola', 'wamid.dup')));
    await svc.handleWebhook(webhook(text('Hola', 'wamid.dup')));
    expect(chat.handleMessage).toHaveBeenCalledTimes(1);
  });

  it('a un audio o una imagen responde que por ahora solo lee texto, sin llamar al agente', async () => {
    const { svc, chat, client } = setup();
    await svc.handleWebhook(webhook({ from: '573001112233', id: 'a1', type: 'audio', audio: { id: 'm' } }));
    expect(chat.handleMessage).not.toHaveBeenCalled();
    expect(client.sendText).toHaveBeenCalledWith('PN1', '573001112233', UNSUPPORTED_MESSAGE);
  });

  it('ignora en silencio las reacciones', async () => {
    const { svc, chat, client } = setup();
    await svc.handleWebhook(webhook({ from: '57300', id: 'r1', type: 'reaction', reaction: { emoji: '🙏' } }));
    expect(chat.handleMessage).not.toHaveBeenCalled();
    expect(client.sendText).not.toHaveBeenCalled();
  });

  it('sin línea registrada o sin agente asignado no responde', async () => {
    const sinLinea = setup(null);
    await sinLinea.svc.handleWebhook(webhook(text('Hola'), 'PN_DESCONOCIDO'));
    expect(sinLinea.chat.handleMessage).not.toHaveBeenCalled();

    const sinAgente = setup({ meta_phone_number_id: 'PN1', agent_id: null });
    await sinAgente.svc.handleWebhook(webhook(text('Hola')));
    expect(sinAgente.chat.handleMessage).not.toHaveBeenCalled();
  });

  it('un error al responder no rompe el procesamiento del resto', async () => {
    const { svc, client } = setup();
    client.sendText.mockRejectedValueOnce(new Error('Meta caído'));
    await expect(svc.handleWebhook(webhook(text('Hola', 'e1')))).resolves.toBeUndefined();
  });
});

describe('WhatsAppCloudController', () => {
  const service = { handleWebhook: jest.fn(async () => undefined) } as any;
  const ctrl = new WhatsAppCloudController(service, config);

  it('verificación del webhook: devuelve el challenge si el verify token coincide', () => {
    expect(ctrl.verify('subscribe', 'verify-me', '12345')).toBe('12345');
  });
  it('verificación del webhook: 403 si el verify token no coincide', () => {
    expect(() => ctrl.verify('subscribe', 'otro', '12345')).toThrow(ForbiddenException);
  });

  it('POST con firma válida responde de inmediato y procesa el mensaje', () => {
    const body = JSON.stringify(webhook(text('Hola')));
    const sig = `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}`;
    expect(ctrl.receive({ rawBody: Buffer.from(body) } as any, sig, JSON.parse(body))).toEqual({ ok: true });
    expect(service.handleWebhook).toHaveBeenCalled();
  });

  it('POST con firma inválida se rechaza sin procesar', () => {
    service.handleWebhook.mockClear();
    expect(() => ctrl.receive({ rawBody: Buffer.from('{}') } as any, 'sha256=00', {})).toThrow(ForbiddenException);
    expect(service.handleWebhook).not.toHaveBeenCalled();
  });
});
