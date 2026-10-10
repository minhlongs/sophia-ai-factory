'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type {
  EnterpriseQuote,
  EnterpriseContract,
  CustomerSignerInput,
} from '@/seed/types/enterprise-contracts';
import {
  createEnterpriseQuote,
  getQuoteById,
  convertQuoteToContract,
  getContractById,
  executeContractSigning,
  type CreateQuoteInput,
} from '@/land/contracts/quote-to-cash-workflow';
import {
  generateContractLegalTerms,
  generateContractHtml,
} from '@/tree/contracts/contract-generator';
import type { ContractActionError } from './types';
import { assertContractAccess } from './contract-access';

/**
 * Server Action: Generate a new custom Enterprise Volume Quote.
 */
export async function generateEnterpriseQuoteAction(
  input: CreateQuoteInput,
): Promise<Result<EnterpriseQuote, ContractActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DATABASE_ERROR', message: 'D1 database binding unavailable' });
    }

    const authRes = await assertContractAccess(db, input.orgId);
    if (!authRes.ok) return authRes;

    const quote = await createEnterpriseQuote(db, input);
    return success(quote);
  } catch (err) {
    const error = toError(err);
    logger.error('[EnterpriseContractActions] generateQuote error', error);
    return failure({ code: 'CREATE_QUOTE_FAILED', message: error.message });
  }
}

/**
 * Server Action: Retrieve an Enterprise Quote by ID.
 */
export async function getEnterpriseQuoteAction(
  quoteId: string,
): Promise<Result<EnterpriseQuote, ContractActionError>> {
  try {
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

    return success(quote);
  } catch (err) {
    const error = toError(err);
    logger.error('[EnterpriseContractActions] getQuote error', error);
    return failure({ code: 'GET_QUOTE_FAILED', message: error.message });
  }
}

/**
 * Server Action: Accept an Enterprise Quote and convert it to an SLA Contract.
 */
export async function convertQuoteToContractAction(
  quoteId: string,
): Promise<Result<EnterpriseContract, ContractActionError>> {
  try {
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

    const contract = await convertQuoteToContract(db, quoteId);
    return success(contract);
  } catch (err) {
    const error = toError(err);
    logger.error('[EnterpriseContractActions] convertQuote error', error);
    return failure({ code: 'CONVERT_CONTRACT_FAILED', message: error.message });
  }
}

/**
 * Server Action: Retrieve an Enterprise Contract by ID.
 */
export async function getEnterpriseContractAction(
  contractId: string,
): Promise<Result<EnterpriseContract, ContractActionError>> {
  try {
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

    return success(contract);
  } catch (err) {
    const error = toError(err);
    logger.error('[EnterpriseContractActions] getContract error', error);
    return failure({ code: 'GET_CONTRACT_FAILED', message: error.message });
  }
}

/**
 * Server Action: Digitally sign an Enterprise Contract.
 */
export async function signEnterpriseContractAction(
  contractId: string,
  signer: CustomerSignerInput,
): Promise<Result<EnterpriseContract, ContractActionError>> {
  try {
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

    const signedContract = await executeContractSigning(db, contractId, signer);
    return success(signedContract);
  } catch (err) {
    const error = toError(err);
    logger.error('[EnterpriseContractActions] signContract error', error);
    return failure({ code: 'SIGN_CONTRACT_FAILED', message: error.message });
  }
}

/**
 * Server Action: Retrieve formatted legal terms (Markdown and HTML) for an enterprise contract.
 */
export async function getContractTermsDocumentAction(
  contractId: string,
  locale: 'vi' | 'en' = 'vi',
): Promise<Result<{ termsMarkdown: string; termsHtml: string }, ContractActionError>> {
  try {
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

    const termsMarkdown = generateContractLegalTerms(contract, locale);
    const termsHtml = generateContractHtml(contract, locale);

    return success({ termsMarkdown, termsHtml });
  } catch (err) {
    const error = toError(err);
    logger.error('[EnterpriseContractActions] getTermsDocument error', error);
    return failure({ code: 'GET_TERMS_FAILED', message: error.message });
  }
}
