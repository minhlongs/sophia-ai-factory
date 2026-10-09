/**
 * Vietnam VAS TT200 Chart of Accounts Double-Entry Journal Mapping
 * Layer: tree/finance
 *
 * @module tree/finance/close/vas-journal-mapper
 */

import type { IntercompanyTransfer } from '@/seed/types/financial-close';
import type { VasJournalEntry } from './types';

/**
 * Generate balanced Vietnam VAS TT200 Chart of Accounts double-entry journal lines
 */
export function generateVasJournalEntries(transfer: IntercompanyTransfer): VasJournalEntry[] {
  const isVnRecipient = transfer.destinationEntity === 'SOPHIA_VN_CO_LTD';
  const isVnOrigin = transfer.originEntity === 'SOPHIA_VN_CO_LTD';

  if (!isVnRecipient && !isVnOrigin) {
    // Non-VN intercompany standard clearing
    return [
      {
        account: '136', // Intercompany receivable
        debitCents: transfer.grossAmountCents,
        creditCents: 0,
        description: `Intercompany billing ${transfer.transferReference}`,
      },
      {
        account: '336', // Intercompany payable
        debitCents: 0,
        creditCents: transfer.grossAmountCents,
        description: `Intercompany clearing ${transfer.transferReference}`,
      },
    ];
  }

  if (isVnOrigin) {
    // Sophia VN paying abroad (e.g. IP royalty or compute recharge to US/SG)
    return [
      {
        account: '642', // General & Administrative service expense
        debitCents: transfer.grossAmountCents,
        creditCents: 0,
        description: `Expense recharge from ${transfer.destinationEntity} (${transfer.transferType})`,
      },
      {
        account: '3338', // Vietnam Foreign Contractor Tax (FCT) payable
        debitCents: 0,
        creditCents: transfer.withholdingTaxAmountCents,
        description: `Statutory FCT withholding (${transfer.withholdingTaxRegime})`,
      },
      {
        account: '336', // Intercompany payable to offshore entity
        debitCents: 0,
        creditCents: transfer.netSettlementCents,
        description: `Net payable to ${transfer.destinationEntity}`,
      },
    ];
  }

  // Sophia VN receiving payment from abroad
  return [
    {
      account: '112', // Cash/Bank deposit
      debitCents: transfer.netSettlementCents,
      creditCents: 0,
      description: `Net inward remittance from ${transfer.originEntity}`,
    },
    {
      account: '136', // Intercompany receivable
      debitCents: 0,
      creditCents: transfer.netSettlementCents,
      description: `Clearing intercompany settlement ${transfer.transferReference}`,
    },
  ];
}
