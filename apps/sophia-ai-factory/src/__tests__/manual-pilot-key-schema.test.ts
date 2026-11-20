// @vitest-environment node
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect,it,vi} from 'vitest';
import {NodeSqliteD1Database} from '@/seed/db/node-sqlite/database';
const mocks=vi.hoisted(()=>({db:null as unknown,from:vi.fn()}));
vi.mock('@/seed/db/node-sqlite/migrations',()=>({applyMigrations:vi.fn()}));
vi.mock('@/seed/db/client',()=>({getD1:()=>mocks.db,createServerClient:()=>({from:mocks.from})}));
vi.mock('@/seed/auth/better-auth-session',()=>({getCurrentUser:vi.fn()}));
vi.mock('@/seed/observability/sentry-forwarder',()=>({forwardToSentry:vi.fn()}));
vi.mock('@/seed/utils/logger-utility',()=>({logger:{error:vi.fn()}}));
import {validateMissionApiKey} from '@/tree/missions/api-key-auth';
it('deliberately denies canonical org-only keys without querying nonexistent user_id',async()=>{
 const db=new NodeSqliteD1Database(':memory:');mocks.db=db;
 const sql=readFileSync(resolve('migrations/0001-init.sql'),'utf8');
 const table=sql.match(/CREATE TABLE IF NOT EXISTS raas_api_keys \([\s\S]*?\n\);/)?.[0];
 expect(table).toBeTruthy();await db.exec(table!);
 const result=await validateMissionApiKey('Bearer test-fixture-key',null);
 expect(result).toMatchObject({valid:false,errorType:'invalid_key'});
 expect(result.error).toContain('principal mapping');expect(mocks.from).not.toHaveBeenCalled();
});
