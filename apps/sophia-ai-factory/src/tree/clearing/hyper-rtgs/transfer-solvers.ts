/**
 * Transfer solvers for Multilateral Netting
 *
 * @module tree/clearing/hyper-rtgs/transfer-solvers
 */

import type {
  BilateralNetTransfer,
  DirectionalNetTransfer,
} from './types';

export function solveDirectionalNetTransfers(netPositions: Record<string, number>): {
  netSettlementVolumeCents: number;
  netTransfers: DirectionalNetTransfer[];
} {
  let netSettlementVolumeCents = 0;
  const directionalTransfers: DirectionalNetTransfer[] = [];
  for (const [participantId, balance] of Object.entries(netPositions)) {
    if (balance > 0) {
      netSettlementVolumeCents += balance;
      directionalTransfers.push({
        participantId,
        netPositionCents: balance,
        direction: 'RECEIVE',
      });
    } else if (balance < 0) {
      directionalTransfers.push({
        participantId,
        netPositionCents: Math.abs(balance),
        direction: 'PAY',
      });
    } else {
      directionalTransfers.push({
        participantId,
        netPositionCents: 0,
        direction: 'SETTLED_FLAT',
      });
    }
  }
  return {
    netSettlementVolumeCents,
    netTransfers: directionalTransfers.filter((t) => t.direction !== 'SETTLED_FLAT'),
  };
}

export function solveBilateralNetTransfers(
  netPositions: Record<string, number>,
  currency: string,
): {
  netSettlementVolumeCents: number;
  netTransfers: BilateralNetTransfer[];
} {
  const debtors: Array<{ id: string; amount: number }> = [];
  const creditors: Array<{ id: string; amount: number }> = [];
  for (const [id, net] of Object.entries(netPositions)) {
    if (net < 0) debtors.push({ id, amount: Math.abs(net) });
    else if (net > 0) creditors.push({ id, amount: net });
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  let netSettlementVolumeCents = 0;
  const bilateralTransfers: BilateralNetTransfer[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const settle = Math.min(debtors[dIdx].amount, creditors[cIdx].amount);
    if (settle > 0) {
      bilateralTransfers.push({
        from: debtors[dIdx].id,
        to: creditors[cIdx].id,
        currency,
        amountCents: settle,
      });
      netSettlementVolumeCents += settle;
      debtors[dIdx].amount -= settle;
      creditors[cIdx].amount -= settle;
    }
    if (debtors[dIdx].amount === 0) dIdx++;
    if (creditors[cIdx].amount === 0) cIdx++;
  }

  return { netSettlementVolumeCents, netTransfers: bilateralTransfers };
}
