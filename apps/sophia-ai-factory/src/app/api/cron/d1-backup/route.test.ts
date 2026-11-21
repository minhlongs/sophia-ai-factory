import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/forest/dr/scheduled-d1-backup', () => ({
  CRON_NAME: 'd1-backup', runScheduledD1Backup: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock('@/seed/observability/cron-check-in', () => ({
  startCronCheckIn: vi.fn(() => ({ checkInId: null, startedAt: 0 })),
  finishCronCheckIn: vi.fn(), failCronCheckIn: vi.fn(),
}));
vi.mock('@/seed/observability/telemetry/better-stack-client', () => ({
  pushHeartbeat: vi.fn().mockResolvedValue(undefined), pushFatalLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/seed/utils/logger-utility', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
import { GET, POST } from './route';
import { runScheduledD1Backup } from '@/forest/dr/scheduled-d1-backup';
import { startCronCheckIn, finishCronCheckIn, failCronCheckIn } from '@/seed/observability/cron-check-in';
import { pushHeartbeat, pushFatalLog } from '@/seed/observability/telemetry/better-stack-client';
const db = {};
const bucket = {};
function request(authorized = true) {
  return new NextRequest('https://worker.invalid/api/cron/d1-backup', {
    headers: authorized ? { authorization: 'Bearer synthetic-backup-test' } : {},
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('CRON_SECRET', 'synthetic-backup-test');
  vi.stubGlobal('__env__', { DB: db, BACKUPS_BUCKET: bucket, BACKUP_HEARTBEAT_URL: 'https://heartbeat.invalid' });
  vi.mocked(runScheduledD1Backup).mockResolvedValue({ ok: true });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('backup HTTP adapter', () => {
  it('requires authentication before all backup work and telemetry', async () => {
    expect((await GET(request(false))).status).toBe(401);
    expect(startCronCheckIn).not.toHaveBeenCalled();
    expect(runScheduledD1Backup).not.toHaveBeenCalled();
  });
  it.each([GET, POST])('preserves check-ins and heartbeat for authenticated HTTP', async (handler) => {
    expect((await handler(request())).status).toBe(200);
    expect(runScheduledD1Backup).toHaveBeenCalledWith({ DB: db, BACKUPS_BUCKET: bucket });
    expect(pushHeartbeat).toHaveBeenCalledWith('https://heartbeat.invalid');
    expect(finishCronCheckIn).toHaveBeenCalled();
  });
  it('preserves tracking failure and confirmed artifact in HTTP response', async () => {
    vi.mocked(runScheduledD1Backup).mockResolvedValue({ ok: false, reason: 'backup_tracking_failed', artifactPresent: true });
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ artifactPresent: true, reason: 'backup_tracking_failed' });
    expect(pushFatalLog).toHaveBeenCalled();
    expect(failCronCheckIn).toHaveBeenCalled();
  });
  it.each(['DB', 'BACKUPS_BUCKET'])('reports missing %s with a failed check-in', async (binding) => {
    vi.stubGlobal('__env__', binding === 'DB' ? { BACKUPS_BUCKET: bucket } : { DB: db });
    expect((await GET(request())).status).toBe(500);
    expect(failCronCheckIn).toHaveBeenCalled();
  });
});
