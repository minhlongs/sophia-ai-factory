'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import type {
  EnterpriseQuote,
  EnterpriseContract,
  CustomerSignerInput,
} from '@/seed/types/enterprise-contracts';
import {
  createEnterpriseQuote,
  convertQuoteToContract,
  executeContractSigning,
  type CreateQuoteInput,
} from '@/land/contracts/quote-to-cash-workflow';
import {
  generateContractLegalTerms,
  generateContractHtml,
} from '@/tree/contracts/contract-generator';
import type { ContractActionError } from './types';
import { assertContractAccess } from './contract-access';
import {
  loadAuthorizedQuote,
  loadAuthorizedContract,
  runContractAction,
} from './quote-contract-action-helpers';

/**
 * Server Action: Generate a new custom Enterprise Volume Quote.
 */
export async function generateEnterpriseQuoteAction(
  input: CreateQuoteInput,
): Promise<Result<EnterpriseQuote, ContractActionError>> {
  return runContractAction('generateQuote', 'CREATE_QUOTE_FAILED', async () => {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DATABASE_ERROR', message: 'D1 database binding unavailable' });
    }
    const authRes = await assertContractAccess(db, input.orgId);
    if (!authRes.ok) return authRes;
    const quote = await createEnterpriseQuote(db, input);
    return success(quote);
  });
}

/**
 * Server Action: Retrieve an Enterprise Quote by ID.
 */
export async function getEnterpriseQuoteAction(
  quoteId: string,
): Promise<Result<EnterpriseQuote, ContractActionError>> {
  return runContractAction('getQuote', 'GET_QUOTE_FAILED', async () => {
    const loaded = await loadAuthorizedQuote(quoteId);
    if (!loaded.ok) return loaded;
    return success(loaded.value.quote);
  });
}

/**
 * Server Action: Accept an Enterprise Quote and convert it to an SLA Contract.
 */
export async function convertQuoteToContractAction(
  quoteId: string,
): Promise<Result<EnterpriseContract, ContractActionError>> {
  return runContractAction('convertQuote', 'CONVERT_CONTRACT_FAILED', async () => {
    const loaded = await loadAuthorizedQuote(quoteId);
    if (!loaded.ok) return loaded;
    const contract = await convertQuoteToContract(loaded.value.db, quoteId);
    return success(contract);
  });
}

/**
 * Server Action: Retrieve an Enterprise Contract by ID.
 */
export async function getEnterpriseContractAction(
  contractId: string,
): Promise<Result<EnterpriseContract, ContractActionError>> {
  return runContractAction('getContract', 'GET_CONTRACT_FAILED', async () => {
    const loaded = await loadAuthorizedContract(contractId);
    if (!loaded.ok) return loaded;
    return success(loaded.value.contract);
  });
}

/**
 * Server Action: Digitally sign an Enterprise Contract.
 */
export async function signEnterpriseContractAction(
  contractId: string,
  signer: CustomerSignerInput,
): Promise<Result<EnterpriseContract, ContractActionError>> {
  return runContractAction('signContract', 'SIGN_CONTRACT_FAILED', async () => {
    const loaded = await loadAuthorizedContract(contractId);
    if (!loaded.ok) return loaded;
    const signedContract = await executeContractSigning(loaded.value.db, contractId, signer);
    return success(signedContract);
  });
}

/**
 * Server Action: Retrieve formatted legal terms (Markdown and HTML) for an enterprise contract.
 */
export async function getContractTermsDocumentAction(
  contractId: string,
  locale: 'vi' | 'en' = 'vi',
): Promise<Result<{ termsMarkdown: string; termsHtml: string }, ContractActionError>> {
  return runContractAction('getTermsDocument', 'GET_TERMS_FAILED', async () => {
    const loaded = await loadAuthorizedContract(contractId);
    if (!loaded.ok) return loaded;
    const termsMarkdown = generateContractLegalTerms(loaded.value.contract, locale);
    const termsHtml = generateContractHtml(loaded.value.contract, locale);
    return success({ termsMarkdown, termsHtml });
  });
}
