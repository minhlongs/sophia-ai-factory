/**
 * Advanced White-Label & Custom Domain Federation Engine (Facade)
 *
 * Layer: tree (domain business logic & D1 database operations)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * Submodules:
 * - types: UnbrandedAgencyPortalConfig, WhitelabelThemeInput, UnbrandedPortalMetadata
 * - color-validator: validateHexColor, sanitizeUrlForCss
 * - css-sanitizer: sanitizeBrandCss
 * - footer-sanitizer: sanitizeFooterHtml
 * - theme-resolver: resolveWhitelabelTheme, generateThemeCssBlock
 * - domain-resolver: resolveAgencyByDomain
 * - slug-resolver: resolveAgencyBySlug
 * - metadata-renderer: renderUnbrandedPortalMetadata
 *
 * @module tree/partners/whitelabel-portal
 */

export * from './whitelabel';
