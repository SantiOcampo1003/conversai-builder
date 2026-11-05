import { ForbiddenException } from '@nestjs/common';
import { WhatsAppLinesController } from './whatsapp-lines.controller';

function setup(accessError?: Error) {
  const access = {
    assertClientAccess: jest.fn(async () => {
      if (accessError) throw accessError;
    }),
  } as any;
  const lines = {
    listAndSync: jest.fn(async () => ({ lines: [{ id: 'l1' }], syncError: null })),
    clientIdOf: jest.fn(async () => 'c1'),
    logout: jest.fn(async () => ({ id: 'l1', status: 'disconnected' })),
    refresh: jest.fn(async () => ({ id: 'l1' })),
    remove: jest.fn(async () => undefined),
  } as any;
  return { ctrl: new WhatsAppLinesController(lines, access), access, lines };
}

describe('WhatsAppLinesController', () => {
  it('GET exige acceso view al cliente y devuelve líneas y aviso de sync', async () => {
    const { ctrl, access } = setup();
    await expect(ctrl.list('Bearer t', 'c1')).resolves.toEqual({ lines: [{ id: 'l1' }], syncError: null });
    expect(access.assertClientAccess).toHaveBeenCalledWith('Bearer t', 'c1', 'view');
  });

  it('logout resuelve el cliente de la línea y exige manage antes de actuar', async () => {
    const { ctrl, access, lines } = setup();
    await expect(ctrl.logout('Bearer t', 'l1')).resolves.toEqual({ line: { id: 'l1', status: 'disconnected' } });
    expect(lines.clientIdOf).toHaveBeenCalledWith('l1');
    expect(access.assertClientAccess).toHaveBeenCalledWith('Bearer t', 'c1', 'manage');
  });

  it('refresh solo exige view', async () => {
    const { ctrl, access } = setup();
    await ctrl.refresh('Bearer t', 'l1');
    expect(access.assertClientAccess).toHaveBeenCalledWith('Bearer t', 'c1', 'view');
  });

  it('sin permiso no llama al servicio', async () => {
    const { ctrl, lines } = setup(new ForbiddenException('No tienes permiso sobre este cliente'));
    await expect(ctrl.remove('Bearer t', 'l1')).rejects.toThrow(ForbiddenException);
    expect(lines.remove).not.toHaveBeenCalled();
  });
});

describe('CreateLineDto', () => {
  const { validate } = require('class-validator');
  const { plainToInstance } = require('class-transformer');
  const { CreateLineDto } = require('./whatsapp-lines.controller');

  it.each(['00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'facf871a-d062-4ea9-98a0-03a6d57fa898'])(
    'acepta el client_id %s que existe en la base',
    async (clientId) => {
      const errors = await validate(plainToInstance(CreateLineDto, { clientId, lineName: 'Ventas' }));
      expect(errors).toHaveLength(0);
    },
  );

  it('rechaza un clientId que no tiene forma de uuid', async () => {
    const errors = await validate(plainToInstance(CreateLineDto, { clientId: 'abc', lineName: 'Ventas' }));
    expect(errors).toHaveLength(1);
  });
});
