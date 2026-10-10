import { createServerClient, tryCreateServerClient } from '@/seed/db/client';
import type { D1Like } from './types';

export function resolveDb(dbOverride?: unknown): D1Like {
  if (dbOverride && typeof (dbOverride as D1Like).prepare === 'function') {
    return dbOverride as D1Like;
  }
  const client = tryCreateServerClient();
  if (client) {
    return client as unknown as D1Like;
  }
  return createServerClient() as unknown as D1Like;
}
