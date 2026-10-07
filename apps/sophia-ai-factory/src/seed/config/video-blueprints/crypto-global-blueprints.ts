/**
 * Crypto Global Video Blueprints Facade
 *
 * Re-exports Crypto blueprints for high-volume fee rebate conversion.
 * Layer: seed (foundational primitives & config)
 * @module seed/config/video-blueprints/crypto-global-blueprints
 */

import type { VideoBlueprint } from './blueprint-types';
import { CRYPTO_BLUEPRINT_FEE_DISCOUNT_SIGNUP_BONUS } from './crypto-fee-discount-blueprint';
import { CRYPTO_BLUEPRINT_TRADING_BOT_COPY_TRADING } from './crypto-trading-bot-blueprint';
import { CRYPTO_BLUEPRINT_EXCHANGE_LAUNCHPOOL } from './crypto-launchpool-blueprint';

export {
  CRYPTO_BLUEPRINT_FEE_DISCOUNT_SIGNUP_BONUS,
  CRYPTO_BLUEPRINT_TRADING_BOT_COPY_TRADING,
  CRYPTO_BLUEPRINT_EXCHANGE_LAUNCHPOOL,
};

export const ALL_CRYPTO_BLUEPRINTS: VideoBlueprint[] = [
  CRYPTO_BLUEPRINT_FEE_DISCOUNT_SIGNUP_BONUS,
  CRYPTO_BLUEPRINT_TRADING_BOT_COPY_TRADING,
  CRYPTO_BLUEPRINT_EXCHANGE_LAUNCHPOOL,
];
