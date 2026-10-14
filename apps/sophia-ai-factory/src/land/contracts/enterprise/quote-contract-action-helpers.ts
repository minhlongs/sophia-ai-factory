/**
 * Shared D1 lookup and RBAC authorization helpers for Enterprise Quote & Contract actions.
 * @module land/contracts/enterprise/quote-contract-action-helpers
 */

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import type {
  EnterpriseQuote,
  EnterpriseContract,
} from '@/seed/types/enterprise-contracts';
import {
  getQuoteById,
  getContractById,
} from '@/land/contracts/quote-to-cash-workflow';
import type { ContractActionError } from './types';
import { assertContractAccess } from './contract-access';

export type AuthorizedQuoteResult = Result<
  { db: NonNullable<Awaited<ReturnType<typeof getD1>>>; quote: EnterpriseQuote },
  ContractActionError
>;

export type AuthorizedContractResult = Result<
  { db: NonNullable<Awaited<ReturnType<typeof getD1>>>; contract: EnterpriseContract },
  ContractActionError
>;

export async function loadAuthorizedQuote(quoteId: string): Promise<AuthorizedQuoteResult> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'DATABASE_ERROR', message: 'D1 database binding unavailable' });
  }

  const quote = await getQuoteById(db, quoteId);
  if (!quote) {
    return failure({ code: 'NOT_FOUND', message: 'Enterprise quote not found' });
  }

  const authRes = await assertContractAccess(db, quote.orgId);
  if (!authRes.ok) return authRes;

  return success({ db, quote });
}

export async function loadAuthorizedContract(contractId: string): Promise<AuthorizedContractResult> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'DATABASE_ERROR', message: 'D1 database binding unavailable' });
  }

  const contract = await getContractById(db, contractId);
  if (!contract) {
    return failure({ code: 'NOT_FOUND', message: 'Enterprise contract not found' });
  }

  const authRes = await assertContractAccess(db, contract.orgId);
  if (!authRes.ok) return authRes;

  return success({ db, contract });
}
