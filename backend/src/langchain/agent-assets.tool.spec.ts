import { createSendFileTool } from './agent-assets.tool';
import { buildBusinessInfo, DEFAULT_PRODUCT_PHOTO_WHEN, MAX_FILES_PER_REPLY } from './prompt.builder';
import { Agent, AgentAsset, OutboundFile } from '../common/types/agent.types';

const asset = (over: Partial<AgentAsset> = {}): AgentAsset => ({
  asset_key: 'brochure_cantera',
  kind: 'document',
  title: 'Brochure Cantera',
  caption: 'Aquí tienes el brochure',
  send_when: 'cuando pregunten por la convocatoria',
  product_id: null,
  public_url: 'https://cdn.test/brochure.pdf',
  file_name: 'Cantera.pdf',
  mime_type: 'application/pdf',
  ...over,
});

function makeDb(insertError: unknown = null) {
  const insert = jest.fn().mockResolvedValue({ error: insertError });
  const from = jest.fn().mockReturnValue({ insert });
  return { db: { getAdminClient: () => ({ from }) } as any, from, insert };
}

describe('send_file tool', () => {
  it('encola el archivo, lo marca como enviado y registra el envío', async () => {
    const { db, from, insert } = makeDb();
    const outbox: OutboundFile[] = [];
    const sent = new Set<string>();
    const tool = createSendFileTool(db, 'ag1', '573001', [asset()], sent, outbox);

    const res = await tool.invoke({ asset_key: 'brochure_cantera' });

    expect(res).toContain('se enviará');
    expect(outbox).toEqual([
      {
        assetKey: 'brochure_cantera',
        type: 'document',
        url: 'https://cdn.test/brochure.pdf',
        fileName: 'Cantera.pdf',
        mimetype: 'application/pdf',
        caption: 'Aquí tienes el brochure',
      },
    ]);
    expect(sent.has('brochure_cantera')).toBe(true);
    expect(from).toHaveBeenCalledWith('agent_asset_sends');
    expect(insert).toHaveBeenCalledWith({
      agent_id: 'ag1',
      user_id: '573001',
      asset_key: 'brochure_cantera',
    });
  });

  it('no reenvía un archivo ya enviado', async () => {
    const { db, insert } = makeDb();
    const outbox: OutboundFile[] = [];
    const tool = createSendFileTool(db, 'ag1', 'u', [asset()], new Set(['brochure_cantera']), outbox);

    const res = await tool.invoke({ asset_key: 'brochure_cantera' });

    expect(res).toContain('ya se le envió');
    expect(outbox).toHaveLength(0);
    expect(insert).not.toHaveBeenCalled();
  });

  it('rechaza claves que no existen para el agente', async () => {
    const { db } = makeDb();
    const outbox: OutboundFile[] = [];
    const tool = createSendFileTool(db, 'ag1', 'u', [asset()], new Set(), outbox);

    await expect(tool.invoke({ asset_key: 'inventada' })).rejects.toBeDefined();
    expect(outbox).toHaveLength(0);
  });

  it('no envía más del máximo de archivos por respuesta', async () => {
    const { db } = makeDb();
    const outbox: OutboundFile[] = [];
    const many = Array.from({ length: MAX_FILES_PER_REPLY + 1 }, (_, i) => asset({ asset_key: `f${i}` }));
    const tool = createSendFileTool(db, 'ag1', 'u', many, new Set(), outbox);

    for (let i = 0; i < MAX_FILES_PER_REPLY; i++) await tool.invoke({ asset_key: `f${i}` });
    const res = await tool.invoke({ asset_key: `f${MAX_FILES_PER_REPLY}` });

    expect(res).toContain('máximo');
    expect(outbox).toHaveLength(MAX_FILES_PER_REPLY);
  });

  it('si falla el registro del envío igual entrega el archivo', async () => {
    const { db } = makeDb({ message: 'boom' });
    const outbox: OutboundFile[] = [];
    const tool = createSendFileTool(db, 'ag1', 'u', [asset()], new Set(), outbox);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await tool.invoke({ asset_key: 'brochure_cantera' });

    expect(outbox).toHaveLength(1);
  });
});

describe('buildBusinessInfo con archivos', () => {
  const agent = { agent_id: 'ag1', business_name: 'Negocio', internal_custom_instructions: '' } as Agent;

  it('incluye la sección de archivos con su condición y los ya enviados', () => {
    const txt = buildBusinessInfo(agent, {
      assets: [asset()],
      sentAssetKeys: ['brochure_cantera'],
    });
    expect(txt).toContain('=== ARCHIVOS DISPONIBLES ===');
    expect(txt).toContain('brochure_cantera [PDF]');
    expect(txt).toContain('Enviar cuando: cuando pregunten por la convocatoria');
    expect(txt).toContain('Ya enviados a este cliente (NO los repitas): brochure_cantera');
  });

  it('foto de producto: resuelve el nombre por id, usa la regla por defecto y se lista junto al producto', () => {
    const withProducts = {
      ...agent,
      products: [{ id: 'p1', name: 'Reloj oro', price: '25000' }],
    } as Agent;
    const photo = asset({ asset_key: 'reloj_oro_1', kind: 'image', title: 'Reloj oro', product_id: 'p1', send_when: null });

    const txt = buildBusinessInfo(withProducts, { assets: [photo] });

    expect(txt).toContain('reloj_oro_1 [imagen] (foto de Reloj oro)');
    expect(txt).toContain(`Enviar cuando: ${DEFAULT_PRODUCT_PHOTO_WHEN}`);
    expect(txt).toContain('📷 Fotos para enviar con send_file: reloj_oro_1');
  });

  it('si el nombre del producto cambia, la foto sigue ligada por id', () => {
    const renamed = { ...agent, products: [{ id: 'p1', name: 'Reloj de oro 18k', price: '25000' }] } as Agent;
    const photo = asset({ asset_key: 'reloj_oro_1', kind: 'image', product_id: 'p1', send_when: null });
    expect(buildBusinessInfo(renamed, { assets: [photo] })).toContain('(foto de Reloj de oro 18k)');
  });

  it('sin archivos no agrega la sección', () => {
    expect(buildBusinessInfo(agent, { assets: [] })).not.toContain('ARCHIVOS DISPONIBLES');
    expect(buildBusinessInfo(agent)).not.toContain('ARCHIVOS DISPONIBLES');
  });
});
