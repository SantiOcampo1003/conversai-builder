import { createSendFileTool } from './agent-assets.tool';
import { buildBusinessInfo } from './prompt.builder';
import { Agent, AgentAsset, OutboundFile } from '../common/types/agent.types';

const asset = (over: Partial<AgentAsset> = {}): AgentAsset => ({
  asset_key: 'brochure_cantera',
  kind: 'document',
  title: 'Brochure Cantera',
  caption: 'Aquí tienes el brochure',
  send_when: 'cuando pregunten por la convocatoria',
  product_ref: null,
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
      assets: [asset(), asset({ asset_key: 'foto_reloj', kind: 'image', title: 'Reloj oro', product_ref: 'reloj oro', send_when: 'cuando pidan ver el reloj' })],
      sentAssetKeys: ['brochure_cantera'],
    });
    expect(txt).toContain('=== ARCHIVOS DISPONIBLES ===');
    expect(txt).toContain('brochure_cantera [PDF]');
    expect(txt).toContain('Enviar cuando: cuando pregunten por la convocatoria');
    expect(txt).toContain('foto_reloj [imagen] (foto de reloj oro)');
    expect(txt).toContain('Ya enviados a este cliente (NO los repitas): brochure_cantera');
  });

  it('sin archivos no agrega la sección', () => {
    expect(buildBusinessInfo(agent, { assets: [] })).not.toContain('ARCHIVOS DISPONIBLES');
    expect(buildBusinessInfo(agent)).not.toContain('ARCHIVOS DISPONIBLES');
  });
});
