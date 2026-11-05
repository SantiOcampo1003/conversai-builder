import { BadGatewayException } from '@nestjs/common';
import { EvolutionInstancesClient } from './evolution-instances.client';

const config = { get: (k: string) => ({ EVOLUTION_API_URL: 'http://evo', EVOLUTION_API_KEY: 'k' })[k] } as any;
const reply = (status: number, body: unknown) =>
  jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));

describe('EvolutionInstancesClient', () => {
  afterEach(() => jest.restoreAllMocks());

  it('404 de Evolution "instance does not exist" → not_found', async () => {
    reply(404, { status: 404, response: { message: ['The "x" instance does not exist'] } });
    await expect(new EvolutionInstancesClient(config).connectionState('x')).resolves.toBe('not_found');
  });

  it('404 de Evolution "Instance not found" (fetchInstances) → sin dueño', async () => {
    reply(404, { status: 404, response: { message: ['Instance "x" not found'] } });
    await expect(new EvolutionInstancesClient(config).remove('x')).resolves.toBeUndefined();
  });

  it('otro 404 (URL o proxy mal configurado) no se toma como instancia borrada', async () => {
    reply(404, { message: 'Cannot GET /instance/connectionState/x', error: 'Not Found', statusCode: 404 });
    await expect(new EvolutionInstancesClient(config).connectionState('x')).rejects.toThrow(BadGatewayException);
  });

  it('errores de Evolution salen como 502 con el motivo, no como 500', async () => {
    reply(500, { response: { message: 'Connection Closed' } });
    await expect(new EvolutionInstancesClient(config).connect('x')).rejects.toThrow(/Connection Closed/);
  });
});
