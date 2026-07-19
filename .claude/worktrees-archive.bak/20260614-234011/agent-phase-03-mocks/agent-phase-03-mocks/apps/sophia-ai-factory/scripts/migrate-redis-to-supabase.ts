/**
 * Redis → Supabase Data Migration Script
 *
 * One-time migration script to transfer license data from Redis to Supabase
 *
 * Usage:
 *   npx tsx scripts/migrate-redis-to-supabase.ts
 *
 * Or with bun:
 *   bun scripts/migrate-redis-to-supabase.ts
 */

import { Redis } from '@upstash/redis'
import { createAdminClient } from '../src/lib/supabase/admin'
import { logger } from '../src/lib/utils/logger-utility'
import { createHash } from 'crypto'

// ============================================================================
// Configuration
// ============================================================================

const REDIS_LICENSE_PREFIX = 'raas:license:'
const REDIS_REVOKED_SET = 'raas:revoked'
const REDIS_REVOKED_AT_PREFIX = 'raas:revoked_at:'
const REDIS_AUDIT_CREATION = 'raas:audit:creation'
const REDIS_AUDIT_REVOCATION = 'raas:audit:revocation'

// ============================================================================
// Types
// ============================================================================

interface RedisLicenseData {
  tier: string
  timestamp: number
  nonce: string
  createdAt: number
  createdBy: string
  validateCount: number
  metadata: Record<string, unknown>
}

interface RedisAuditLog {
  action: string
  nonce: string
  tier?: string
  timestamp: number
  createdBy?: string
}

// ============================================================================
// Migration Functions
// ============================================================================

/**
 * Initialize Redis client
 */
function createRedisClient(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    throw new Error('Redis: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set')
  }

  return new Redis({ url, token })
}

/**
 * Migrate licenses from Redis to Supabase
 */
async function migrateLicenses(redis: Redis): Promise<number> {
  logger.info('Starting license migration...')

  const supabase = createAdminClient()
  const keys = await redis.keys(`${REDIS_LICENSE_PREFIX}*`)

  if (keys.length === 0) {
    logger.info('No licenses found in Redis')
    return 0
  }

  logger.info(`Found ${keys.length} licenses in Redis`)

  let migrated = 0
  let errors = 0

  for (const key of keys) {
    try {
      const nonce = key.replace(REDIS_LICENSE_PREFIX, '')

      // Get license data from Redis
      const data = await redis.get<RedisLicenseData>(key)
      if (!data) {
        logger.warn(`License ${nonce} has no data, skipping`)
        continue
      }

      // Check if already revoked
      const isRevoked = await redis.sismember(REDIS_REVOKED_SET, nonce)
      const revokedAt = isRevoked
        ? await redis.get<number>(`${REDIS_REVOKED_AT_PREFIX}${nonce}`)
        : null

      // Create key hash
      // BREAKING CHANGE: Redis only stored metadata, not full license keys
      // Original keys cannot be reconstructed - validation will fail for migrated licenses
      // Solution: Regenerate new keys for affected users or implement key recovery from backup
      const keyHash = createHash('sha256')
        .update(`migrated:${nonce}`)
        .digest('hex')

      // Insert into Supabase
      const { error } = await supabase
        .from('raas_licenses')
        .insert({
          key_hash: keyHash,
          tier: data.tier as 'basic' | 'premium' | 'enterprise' | 'master',
          nonce,
          expires_at: data.timestamp === 0 ? 0 : data.timestamp,
          is_revoked: isRevoked,
          revoked_at: revokedAt,
          created_at: data.createdAt,
          created_by: null, // Original creator not available in migration
          metadata: {
            ...data.metadata,
            validateCount: data.validateCount,
            migrated: true,
            migratedAt: Math.floor(Date.now() / 1000),
            // FLAG: Original key not available - validation will require key regeneration
            requiresKeyRegeneration: true
          }
        })

      if (error) {
        logger.error(`Failed to insert license ${nonce}`, error)
        errors++
      } else {
        migrated++
        logger.info(`Migrated license ${nonce} (${data.tier})`)
      }
    } catch (error) {
      logger.error(`Error migrating license ${key}`, error)
      errors++
    }
  }

  logger.info(`License migration complete: ${migrated} migrated, ${errors} errors`)
  return migrated
}

/**
 * Migrate audit logs from Redis to Supabase
 */
async function migrateAuditLogs(redis: Redis): Promise<number> {
  logger.info('Starting audit log migration...')

  const supabase = createAdminClient()
  const auditKeys = [
    REDIS_AUDIT_CREATION,
    REDIS_AUDIT_REVOCATION
  ]

  let migrated = 0
  let errors = 0

  for (const key of auditKeys) {
    try {
      const entries = await redis.lrange(key, 0, -1)

      if (entries.length === 0) {
        logger.info(`No entries in ${key}`)
        continue
      }

      logger.info(`Found ${entries.length} entries in ${key}`)

      for (const entry of entries) {
        try {
          const log = JSON.parse(entry) as RedisAuditLog

          // Get license_id from nonce
          const { data: license } = await supabase
            .from('raas_licenses')
            .select('id')
            .eq('nonce', log.nonce)
            .single()

          const { error } = await supabase
            .from('raas_audit_logs')
            .insert({
              action: log.action as 'CREATE' | 'REVOKE',
              license_id: license?.id || null,
              license_nonce: log.nonce,
              user_id: null,
              ip_address: null,
              user_agent: null,
              created_at: log.timestamp,
              details: {
                tier: log.tier,
                createdBy: log.createdBy,
                migrated: true,
                migratedAt: Math.floor(Date.now() / 1000),
                source: key
              }
            })

          if (error) {
            logger.error(`Failed to insert audit log for ${log.nonce}`, error)
            errors++
          } else {
            migrated++
          }
        } catch (parseError) {
          logger.error(`Failed to parse audit log entry: ${entry}`, parseError)
          errors++
        }
      }
    } catch (error) {
      logger.error(`Error migrating audit logs from ${key}`, error)
      errors++
    }
  }

  logger.info(`Audit log migration complete: ${migrated} migrated, ${errors} errors`)
  return migrated
}

/**
 * Verify migration counts
 */
async function verifyMigration(redis: Redis): Promise<boolean> {
  logger.info('Verifying migration...')

  const supabase = createAdminClient()

  // Count Redis licenses
  const redisLicenseCount = (await redis.keys(`${REDIS_LICENSE_PREFIX}*`)).length

  // Count Supabase licenses
  const { count: supabaseLicenseCount, error: licenseError } = await supabase
    .from('raas_licenses')
    .select('*', { count: 'exact', head: true })

  if (licenseError) {
    logger.error('Failed to count Supabase licenses', licenseError)
    return false
  }

  // Count Redis audit logs
  const redisAuditCount =
    (await redis.llen(REDIS_AUDIT_CREATION)) +
    (await redis.llen(REDIS_AUDIT_REVOCATION))

  // Count Supabase audit logs
  const { count: supabaseAuditCount, error: auditError } = await supabase
    .from('raas_audit_logs')
    .select('*', { count: 'exact', head: true })

  if (auditError) {
    logger.error('Failed to count Supabase audit logs', auditError)
    return false
  }

  // Compare counts
  const licenseMatch = redisLicenseCount === supabaseLicenseCount
  const auditMatch = redisAuditCount === supabaseAuditCount

  logger.info(`Verification results:`)
  logger.info(`  Licenses: Redis=${redisLicenseCount}, Supabase=${supabaseLicenseCount} ${licenseMatch ? '✓' : '✗'}`)
  logger.info(`  Audit logs: Redis=${redisAuditCount}, Supabase=${supabaseAuditCount} ${auditMatch ? '✓' : '✗'}`)

  return licenseMatch && auditMatch
}

/**
 * Main migration function
 */
async function main() {
  logger.info('=== Starting Redis → Supabase Migration ===')

  // Initialize Redis
  const redis = createRedisClient()

  try {
    // Migrate licenses
    const licenseCount = await migrateLicenses(redis)

    // Migrate audit logs
    const auditCount = await migrateAuditLogs(redis)

    // Verify migration
    const verified = await verifyMigration(redis)

    if (verified) {
      logger.info('=== Migration completed successfully! ===')
      logger.info(`Total licenses migrated: ${licenseCount}`)
      logger.info(`Total audit logs migrated: ${auditCount}`)
    } else {
      logger.warn('=== Migration completed with discrepancies ===')
      logger.warn('Please review the logs and manually verify data')
    }
  } catch (error) {
    logger.error('Migration failed', error)
    process.exit(1)
  } finally {
    logger.info('Migration script finished')
  }
}

// Run migration
main().catch(console.error)
