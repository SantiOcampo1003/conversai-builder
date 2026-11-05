import { ForbiddenException } from '@nestjs/common';
import { WhatsAppLinesController } from './whatsapp-lines.controller';

function setup(accessError?: Error, level: 'view' | 'manage' = 'manage') {
  const access = {
    assertClientAccess: jest.fn(async () => {
      if (accessError) throw accessError;
    }),
    clientAccessLevel: jest.fn(async () => {
      if (accessError) throw accessError;
      return level;
    }),
  } as any;
  const lines = {
    listAndSync: jest.fn(async () => ({ lines: [{ id: 'l1', qr_code: 'QR' }], syncError: null })),
    clientIdOf: jest.fn(async () => 'c1'),
    logout: jest.fn(async () => ({ id: 'l1', status: 'disconnected' })),
    refresh: jest.fn(async () => ({ id: 'l1', qr_code: 'QR' })),
    remove: jest.fn(async () => undefined),
  } as any;
  return { ctrl: new WhatsAppLinesController(lines, access), access, lines };
}

describe('WhatsAppLinesController', () => {
  it('GET: un admin recibe las líneas con su QR y el aviso de sync', async () => {
    const { ctrl, access } = setup();
    await expect(ctrl.list('Bearer t', 'c1')).resolves.toEqual({ lines: [{ id: 'l1', qr_code: 'QR' }], syncError: null });
    expect(access.clientAccessLevel).toHaveBeenCalledWith('Bearer t', 'c1');
  });

  it('GET: quien solo puede ver no recibe el QR (podría vincular su propio teléfono)', async () => {
    const { ctrl } = setup(undefined, 'view');
    await expect(ctrl.list('Bearer t', 'c1')).resolves.toEqual({ lines: [{ id: 'l1', qr_code: null }], syncError: null });
  });

  it('logout resuelve el cliente de la línea y exige manage antes de actuar', async () => {
    const { ctrl, access, lines } = setup();
    await expect(ctrl.logout('Bearer t', 'l1')).resolves.toEqual({ line: { id: 'l1', status: 'disconnected' } });
    expect(lines.clientIdOf).toHaveBeenCalledWith('l1');
    expect(access.assertClientAccess).toHaveBeenCalledWith('Bearer t', 'c1', 'manage');
  });

  it('refresh: quien solo puede ver consulta el estado sin renovar QR ni recibirlo', async () => {
    const { ctrl, lines } = setup(undefined, 'view');
    await expect(ctrl.refresh('Bearer t', 'l1')).resolves.toEqual({ line: { id: 'l1', qr_code: null } });
    expect(lines.refresh).toHaveBeenCalledWith('l1', false);
  });

  it('refresh: un admin renueva el QR', async () => {
    const { ctrl, lines } = setup();
    await ctrl.refresh('Bearer t', 'l1');
    expect(lines.refresh).toHaveBeenCalledWith('l1', true);
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

describe('WhatsAppLinesController.createMeta', () => {
  it('exige super admin y crea la línea oficial', async () => {
    const access = { assertSuperAdmin: jest.fn(async () => undefined) } as any;
    const lines = { createMetaLine: jest.fn(async () => ({ id: 'l1' })) } as any;
    const ctrl = new WhatsAppLinesController(lines, access);
    await expect(ctrl.createMeta('Bearer t', { clientId: 'c1', lineName: 'Prueba', phoneNumberId: '123456', wabaId: '987654' })).resolves.toEqual({ line: { id: 'l1' } });
    expect(access.assertSuperAdmin).toHaveBeenCalledWith('Bearer t');
    expect(lines.createMetaLine).toHaveBeenCalledWith('c1', 'Prueba', '123456', '987654');
  });

  it('sin super admin no crea nada', async () => {
    const access = { assertSuperAdmin: jest.fn(async () => { throw new ForbiddenException('Solo el super admin puede hacer esto'); }) } as any;
    const lines = { createMetaLine: jest.fn() } as any;
    await expect(new WhatsAppLinesController(lines, access).createMeta('Bearer t', { clientId: 'c1', lineName: 'X', phoneNumberId: '123456' })).rejects.toThrow(
      ForbiddenException,
    );
    expect(lines.createMetaLine).not.toHaveBeenCalled();
  });
});
