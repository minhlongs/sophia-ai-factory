export {
  type AuthGuardOptions,
  DEFAULT_UNAUTHORIZED_RESPONSE,
  AuthError,
  checkAuth,
} from './auth-check';

export {
  withAuth,
  requireAuthJson,
  requireAuthOrThrow,
} from './route-guard-handlers';

export {
  isPublicApiRoute,
} from './public-routes';
