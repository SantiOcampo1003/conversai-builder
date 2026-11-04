import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  it('los contactos de prueba (test_) nunca avisan ni consultan la base', async () => {
    const db: any = { getAdminClient: () => { throw new Error('no debe tocar la base'); } };
    const svc = new NotificationsService(db, {} as any);
    await expect(svc.notifyIfComplete('agente', 'test_claude_x')).resolves.toBe('skipped');
  });
});
