import {
  DEFAULT_TTL_SECONDS,
  MAX_TTL_USER_SECONDS,
  MAX_TTL_SERVICE_SECONDS,
  HARD_TTL_CEILING,
  ExchangeRequestBody,
  TtlValidationResult,
} from './types';

export function validateTtl(
  body: ExchangeRequestBody | null | undefined,
  userRole?: string,
): TtlValidationResult {
  const extended = body?.extended === true;

  if (typeof body?.ttlSeconds === 'number' && body.ttlSeconds > 0) {
    const requested = Math.floor(body.ttlSeconds);

    if (requested > HARD_TTL_CEILING) {
      return {
        success: false,
        error: 'ttlSeconds exceeds hard ceiling of 7 days (604800 seconds)',
        status: 400,
      };
    }

    if (requested > MAX_TTL_USER_SECONDS) {
      if (!extended) {
        return {
          success: false,
          error: 'ttlSeconds > 86400 requires { extended: true } and service-account role',
          status: 400,
        };
      }
      if (userRole !== 'service') {
        return {
          success: false,
          error: 'extended TTL requires service-account role',
          status: 400,
        };
      }
      return {
        success: true,
        ttlSeconds: Math.min(requested, MAX_TTL_SERVICE_SECONDS),
      };
    }

    return {
      success: true,
      ttlSeconds: requested,
    };
  }

  return {
    success: true,
    ttlSeconds: DEFAULT_TTL_SECONDS,
  };
}
