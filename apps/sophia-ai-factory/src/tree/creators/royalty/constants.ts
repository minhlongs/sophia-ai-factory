/**
 * Creator Royalty Split Engine Constants & Regex Patterns.
 *
 * Layer: tree/creators/royalty
 *
 * @module tree/creators/royalty/constants
 */

export const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
export const VIETQR_BANK_BIN_REGEX = /^\d{6}$/;
export const VIETQR_ACCOUNT_REGEX = /^[a-zA-Z0-9]{4,30}$/;
export const PROMPTPAY_PHONE_REGEX = /^0[689]\d{8}$/;
export const PROMPTPAY_NATIONAL_ID_REGEX = /^\d{13}$/;
export const SEPA_IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/;

export const DEFAULT_CONTRACT_SECRET = 'sophia_contract_signing_key_secret_2027';
export const DEFAULT_DESTINATION_ADDRESS = '0x0000000000000000000000000000000000000001';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
