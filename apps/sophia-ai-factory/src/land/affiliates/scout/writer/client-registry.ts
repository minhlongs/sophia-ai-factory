/**
 * Affiliate Scout Client Registry
 *
 * @module land/affiliates/scout/writer/client-registry
 */

import { impactRadiusClient } from '../client-impact-radius';
import { partnerstackClient } from '../client-partnerstack';
import { cjClient } from '../client-cj';
import { shareasaleClient } from '../client-shareasale';
import { awinSaasClient } from '../client-awin';
import { rakutenClient } from '../client-rakuten';
import { binanceClient } from '../client-binance';
import { bybitClient } from '../client-bybit';
import { bitgetClient } from '../client-bitget';
import { coinbaseClient } from '../client-coinbase';

export const ALL_CLIENTS = [
  impactRadiusClient,
  partnerstackClient,
  cjClient,
  shareasaleClient,
  awinSaasClient,
  rakutenClient,
  binanceClient,
  bybitClient,
  bitgetClient,
  coinbaseClient,
];
