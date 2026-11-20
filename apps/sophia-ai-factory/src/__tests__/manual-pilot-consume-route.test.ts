// @vitest-environment node
import { describe,it,expect,vi,beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
const mocks=vi.hoisted(()=>({auth:vi.fn(),deduct:vi.fn(),balance:vi.fn(),member:vi.fn()}));
vi.mock('@/tree/missions/api-key-auth',()=>({validateMissionApiKey:mocks.auth,apiKeyAuthErrorResponse:()=>new Response(null,{status:401})}));
vi.mock('@/tree/mcu/credits-repo',()=>({deductCredits:mocks.deduct,getBalance:mocks.balance}));
vi.mock('@/forest/middleware/rate-limit-wrapper',()=>({withRateLimit:(fn:unknown)=>fn}));
vi.mock('@/seed/db/client',()=>({getD1:async()=>({prepare:()=>({bind:()=>({first:mocks.member})})})}));
import { POST } from '@/app/api/v1/credits/consume/route';
const send=(body:unknown)=>POST(new NextRequest('https://local/api/v1/credits/consume',{method:'POST',body:JSON.stringify(body)}));
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue({valid:true,userId:'u',orgId:'org',authKind:'api_key'});mocks.member.mockResolvedValue({ok:1});mocks.deduct.mockResolvedValue(true);mocks.balance.mockResolvedValue({credits_remaining:100});});
describe('consume tenant authorization boundary',()=>{
 it('propagates server verified key scope to debit and balance',async()=>{
  expect((await send({amount:1})).status).toBe(200);
  expect(mocks.deduct).toHaveBeenCalledWith('u',1,expect.any(String),'sdk_consume','org');
  expect(mocks.balance).toHaveBeenCalledWith('u','org');
 });
 it('rejects another org even with membership',async()=>{
  expect((await send({amount:1,orgId:'other'})).status).toBe(403);expect(mocks.deduct).not.toHaveBeenCalled();
 });
 it('rejects revoked membership',async()=>{
  mocks.member.mockResolvedValue(null);expect((await send({amount:1})).status).toBe(403);expect(mocks.deduct).not.toHaveBeenCalled();
 });
 it('rejects revoked keys before debit',async()=>{
  mocks.auth.mockResolvedValue({valid:false});expect((await send({amount:1})).status).toBe(401);expect(mocks.deduct).not.toHaveBeenCalled();
 });
 it('preserves user-only legacy calls but rejects org selection by unbound keys',async()=>{
  mocks.auth.mockResolvedValue({valid:true,userId:'u',authKind:'api_key'});
  expect((await send({amount:1})).status).toBe(200);
  expect((await send({amount:1,orgId:'org'})).status).toBe(403);
 });
});
