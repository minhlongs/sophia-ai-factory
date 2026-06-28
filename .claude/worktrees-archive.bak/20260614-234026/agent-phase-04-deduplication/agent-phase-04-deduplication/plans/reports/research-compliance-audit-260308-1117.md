# Compliance Audit Trail & Cryptographic Hashing Patterns Research

**Report Date:** 2026-03-08
**Work Context:** Sophia AI Factory / ROIaaS
**Research Scope:** SOC 2, GDPR, Immutable Logs, Digital Signatures

---

## Executive Summary

This research synthesizes cryptographic hashing and compliance audit trail patterns for ROIaaS Phase 6 certification. Analysis covers existing Sophia AI Factory implementation patterns (HMAC-SHA256, AES-256-GCM, webhook signatures) and maps to industry standards.

**Key Findings:**
- Sophia AI Factory already implements strong cryptographic foundations (HMAC-SHA256, SHA-256 hashing, AES-256-GCM)
- Existing audit trail: `raas_audit_logs` table with 90-day retention per SOC 2
- Missing patterns require implementation for Phase 6: Merkle trees, certificate-based signing, quarantine-immutable storage

**Estimated Implementation Effort:** 2-3 weeks for full Phase 6 compliance

---

## 1. Cryptographic Hashing Patterns

### 1.1 Current Implementation (Existing)

| Pattern | File | Algorithm | Status |
|---------|------|-----------|--------|
| License Key HMAC | `raas-service.ts` | HMAC-SHA256 | ✅ Production |
| Webhook Verification | `webhook-signature-verification.ts` | HMAC-SHA256 | ✅ Production |
| API Key Encryption | `encryption.ts` | AES-256-GCM | ✅ Production |
| Usage Idempotency | `idempotency.ts` | SHA-256 | ✅ Production |
| License Key Hash | `tracker.ts` | SHA-256 | ✅ Production |

### 1.2 Top 5 Cryptographic Patterns for Audit Trail

#### Pattern 1: Chain-of- custody with Hash Pointers (Merkle Tree)

**Purpose:** Prove log integrity, detect any tampering

```
Log Entry N = {
  timestamp,
  action,
  actor,
  previous_hash,    // ← Hash of previous log entry
  current_hash,     // ← SHA-256(this entry)
  payload_hash      // ← SHA-256(full payload)
}
```

**Implementation:**
```typescript
// lib/audit/merkle-log.ts
export interface MerkleLogEntry {
  id: string
  timestamp: number
  action: AuditAction
  actorId: string
  previousHash: string
  payloadHash: string
  currentHash: string
  merkleRoot: string
}

export function computeMerkleRoot(entries: MerkleLogEntry[]): string {
  if (entries.length === 0) return sha256('empty')
  if (entries.length === 1) return entries[0].currentHash

  const hashes = entries.map(e => e.currentHash)
  while (hashes.length > 1) {
    const pairs = chunk(hashes, 2)
    hashes.length = 0
    for (const [a, b] of pairs) {
      hashes.push(sha256(a + b))
    }
  }
  return hashes[0]
}
```

**Libraries:** `crypto` (Node.js built-in)

**Integration:** Add `previousHash` to `raas_audit_logs` table schema

---

#### Pattern 2: Time-Lock Seal with SHA-256

**Purpose:** Prove log existed before a certain timestamp (notarization)

```typescript
// lib/audit/time-seal.ts
export interface TimeSeal {
  logId: string
  timestamp: number
  seal: string  // SHA-256(logId + timestamp +预言工资(number))
}

export function createSeal(logId: string, timestamp: number): TimeSeal {
  const预言工资 = Math.floor(timestamp / 86400) //Daily预言工资

  return {
    logId,
    timestamp,
    seal: createHash('sha256')
      .update(`${logId}:${timestamp}:${预言工资}`)
      .digest('hex')
  }
}

export function verifySeal(seal: TimeSeal): boolean {
  const computed = createHash('sha256')
    .update(`${seal.logId}:${seal.timestamp}:${Math.floor(seal.timestamp / 86400)}`)
    .digest('hex')

  return timingSafeEqual(
    Buffer.from(seal.seal),
    Buffer.from(computed)
  )
}
```

**Use Case:** Compliance audits require proof "log X existed on date Y"

---

#### Pattern 3: Immutable	append-Only Storage with Content-Addressing

**Purpose:** Prevent log modification, link to content

```typescript
// lib/audit/immutable-store.ts
export interface ImmutableLog {
  hash: string
  content: string
  nonce: string
  signature?: string
}

export function createContentAddress(log: any): ImmutableLog {
  const content = JSON.stringify(log, Object.keys(log).sort())
  const hash = createHash('sha256')
    .update(content)
    .digest('hex')

  return { hash, content, nonce: randomBytes(16).toString('hex') }
}
```

**Database Design:**
```sql
CREATE TABLE audit_logs_immutable (
  hash TEXT PRIMARY KEY,      -- SHA-256 hash
  content JSONB NOT NULL,
  nonce TEXT NOT NULL,
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_content_hash ON audit_logs_immutable (hash);
```

**Storage Strategy:**
- Write: hash check + insert
- Read: verify hash matches content
- Delete: ONLY mark as `deleted_at`, never remove

---

#### Pattern 4: SHA-256 with Salt (Prevent Rainbow Table)

**Purpose:** Protect sensitive data in logs

```typescript
// lib/audit/salted-hashes.ts
const SALT = process.env.AUDIT_SALT

export function saltedHash(data: string, salted: boolean = true): string {
  const salt = salted ? SALT : ''
  return createHash('sha256')
    .update(`${salt}${data}`)
    .digest('hex')
}

// Usage for user data in logs
export function hashUserId(userId: string): string {
  return saltedHash(userId)
}

export function hashIpAddress(ip: string): string {
  return saltedHash(ip)
}
```

**Column Transformation:**
| Current | New |
|---------|-----|
| `ip_address` | `ip_hash` (SHA-256 with salt) |
| `user_id` | `user_id_hash` (SHA-256 with salt) |
|保留原始字段 cho admin access |

---

#### Pattern 5: Multi-Algorithm Fingerprinting

**Purpose:** Future-proof against algorithm cracks

```typescript
// lib/audit/fingerprint.ts
import { createHash, createHmac } from 'crypto'

export interface LogFingerprint {
  sha256: string
  hmac: string
  blake3?: string  // For high-performance hashing
}

export function createLogFingerprint(data: string, secret: string): LogFingerprint {
  return {
    sha256: createHash('sha256').update(data).digest('hex'),
    hmac: createHmac('sha256', secret).update(data).digest('hex')
  }
}

export function verifyFingerprint(
  data: string,
  fingerprint: LogFingerprint,
  secret: string
): boolean {
  const computed = createLogFingerprint(data, secret)

  const shaMatch = timingSafeEqual(
    Buffer.from(fingerprint.sha256),
    Buffer.from(computed.sha256)
  )

  const hmacMatch = timingSafeEqual(
    Buffer.from(fingerprint.hmac),
    Buffer.from(computed.hmac)
  )

  return shaMatch && hmacMatch
}
```

**-libraries:** Node.js `crypto` (sha256, hmac), optional `blake3-wasm`

---

## 2. Compliance Audit Trail Design Patterns

### 2.1 SOC 2 Type II Requirements Mapping

| Requirement | Implementation | Evidence |
|-------------|----------------|----------|
| **CC6.1** (Access controls) | Admin-only API routes + Basic Auth | ✅ `/api/admin/licenses/*` |
| **CC6.6** (System boundaries) | Token-based auth in middleware | ✅ `raas-gate.ts` |
| **CC6.7** (Shared keys) | HMAC-SHA256 secrets | ✅ `RAAS_LICENSE_SECRET` |
| **CC6.8** (Network security) | CORS + CSP headers | ✅ `cors-security-configuration.ts` |
| **CC7.1** (Monitoring) | Audit log table | ✅ `raas_audit_logs` |
| **CC7.2** (Anomalies) | webhook timestamp tolerance | ✅ 300s verification |

### 2.2 GDPR Right-to-Erasure Pattern

```typescript
// lib/audit/gdpr-compliance.ts
export async function anonymizeAuditLogsForUser(
  userId: string,
  adminId: string
): Promise<number> {
  const supabase = createAdminClient()

  // Count affected logs
  const { count: affectedCount } = await supabase
    .from('raas_audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (!affectedCount) return 0

  // Anonymize (not delete - maintaining audit trail)
  const { error } = await supabase
    .from('raas_audit_logs')
    .update({
      user_id: null,
      ip_address: '[REDACTED-GDPR-ERASURE]',
      user_agent: '[REDACTED-GDPR-ERASURE]',
      details: {
        ...(supabase.raw as any),
        erasure_request_id: adminId,
        erasure_timestamp: Math.floor(Date.now() / 1000),
        erasure_type: ' Right to erasure (GDPR Art.17)',
      }
    })
    .eq('user_id', userId)

  if (error) throw error

  return affectedCount
}
```

**Existing:** SQL function `anonymize_user_audit_logs()` in `audit-retention-functions.sql`

---

### 2.3 Top 5 Audit Trail Patterns

#### Pattern 1: Immutable write-once storage

**Database Schema:**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN ('CREATE','VALIDATE','REVOKE','UPDATE')),
  license_nonce TEXT NOT NULL,
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  --_hash verification
  content_hash TEXT NOT NULL,
  previous_log_hash TEXT,

  -- Write protection
  deleted_at BIGINT DEFAULT NULL
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_license_nonce ON audit_logs(license_nonce);
```

**Implementation:**
```typescript
// lib/audit/immutable-store.ts
export async function logAuditActionImmutable(params: AuditLogParams): Promise<void> {
  const supabase = createAdminClient()

  const content = JSON.stringify(params, Object.keys(params).sort())
  const contentHash = createHash('sha256').update(content).digest('hex')

  const { error } = await supabase
    .from('audit_logs')
    .insert({
      action: params.action,
      license_nonce: params.nonce,
      user_id: params.userId ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      details: params.details ?? {},
      created_at: params.timestamp,
      content_hash: contentHash,
      // previous_log_hash handled by trigger in DB
    })

  if (error) throw error
}
```

---

#### Pattern 2: Batch Rotating Keys for Log Signing

**Purpose:** Limit damage if key compromised

```typescript
// lib/audit/key-rotation.ts
export class LogSigningManager {
  private currentKey: Buffer
  private previousKeys: Buffer[] = []
  private rotationPeriod: number = 90 * 24 * 60 * 60 * 1000 // 90 days

  constructor() {
    this.currentKey = Buffer.from(process.env.AUDIT_LOG_SIGNING_KEY!, 'hex')
  }

  sign(log: string): string {
    return createHmac('sha256', this.currentKey)
      .update(log)
      .digest('hex')
  }

  verify(log: string, signature: string): boolean {
    // Try current key
    const currentSig = this.sign(log)
    if (timingSafeEqual(Buffer.from(signature), Buffer.from(currentSig))) {
      return true
    }

    // Try previous keys (grace period)
    for (const key of this.previousKeys) {
      const prevHmac = createHmac('sha256', key).update(log).digest('hex')
      if (timingSafeEqual(Buffer.from(signature), Buffer.from(prevHmac))) {
        return true
      }
    }

    return false
  }

  rotateKey(): void {
    this.previousKeys.push(this.currentKey)
    if (this.previousKeys.length > 3) {
      this.previousKeys.shift() // Keep only last 3 keys
    }
    this.currentKey = randomBytes(32)
  }
}
```

---

#### Pattern 3: Signed Statement Pattern (Administrative Proof)

```typescript
// lib/audit/statement.ts
export interface SignedStatement {
  statementId: string
  type: 'CERTIFICATION' | 'COMPLIANCE' | 'ATTESTATION'
  subject: string // What the statement covers
  statements: string[] // Array of compliance assertions
  issuedAt: number
  issuedBy: string // Admin user ID
  validFrom: number
  validUntil: number
  signature: string // HMAC-SHA256
}

export function createSignedStatement(params: {
  statementType: SignedStatement['type']
  subject: string
  assertions: string[]
  issuedBy: string
  validityDays: number
}): SignedStatement {
  const statementId = randomUUID()
  const validFrom = Math.floor(Date.now() / 1000)
  const validUntil = validFrom + (params.validityDays * 86400)

  const content = JSON.stringify({
    statementId,
    type: params.statementType,
    subject: params.subject,
    statements: params.assertions,
    validFrom,
    validUntil
  })

  return {
    statementId,
    type: params.statementType,
    subject: params.subject,
    statements: params.assertions,
    issuedAt: validFrom,
    issuedBy: params.issuedBy,
    validFrom,
    validUntil,
    signature: createHmac('sha256', process.env.AUDIT_SIGNING_SECRET!)
      .update(content)
      .digest('hex')
  }
}
```

**Database:**
```sql
CREATE TABLE compliance_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  assertions JSONB NOT NULL,
  issued_by UUID REFERENCES auth.users(id),
  valid_from BIGINT NOT NULL,
  valid_until BIGINT NOT NULL,
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### Pattern 4: Time-Stamped Archive (Non-repudiation)

```typescript
// lib/audit/timestamp-archive.ts
export interface TimestampedArchive {
  archiveId: string
  logIds: string[]
  archiveHash: string  // SHA-256 of all log hashes
  timestampServer: string  // RFC 3161 timestamp server response
  timestamp: number
  proof: string  // HMAC for verification
}

export async function createArchive(logIds: string[]): Promise<TimestampedArchive> {
  // Sort and hash all log IDs
  const sortedHashes = logIds
    .sort()
    .map(id => createHash('sha256').update(id).digest('hex'))

  const archiveHash = createHash('sha256')
    .update(sortedHashes.join(''))
    .digest('hex')

  return {
    archiveId: randomUUID(),
    logIds,
    archiveHash,
    timestampServer: await getRFC3161Timestamp(), // External TSA service
    timestamp: Math.floor(Date.now() / 1000),
    proof: createHmac('sha256', process.env.AUDIT_TSA_SECRET!)
      .update(archiveHash)
      .digest('hex')
  }
}

// Usage: Daily compliance archive
export async function createDailyComplianceArchive(): Promise<TimestampedArchive> {
  const nearTime = Math.floor(Date.now() / 1000) - 86400
  const { data: logs } = await supabase
    .from('raas_audit_logs')
    .select('license_nonce')
    .gte('created_at', nearTime)

  return createArchive(logs.map(l => l.license_nonce))
}
```

**External Service Integration:**
- [Verisign Time Stamping Service](https://time-stamp.com/)
- [DigiCert Time Stamping](https://www.digicert.com/time-stamping)
- [EJBCA TSA](https://ejbca.org/)

---

#### Pattern 5: Rainbow Table Protection with peppering

```typescript
// lib/audit/peppering.ts
const PEPPER = process.env.AUDIT_PEPPER

export function hashWithPepper(data: string): string {
  // Prepend pepper before hashing
  return createHash('sha256')
    .update(`${PEPPER}${data}`)
    .digest('hex')
}

export function createAnonymizedUserRecord(userId: string, userIp: string) {
  return {
    userIdHash: hashWithPepper(userId),
    userIdHashWithSalt: saltedHash(userId), // Different salt
    ipHash: hashWithPepper(ip),
    auditToken: randomUUID() // Anonymous tracking
  }
}
```

**Implementation for Sophia:**
| Field | Storage Strategy |
|-------|------------------|
| `user_id` | `user_hash` (peppered SHA-256) |
| `ip_address` | `ip_hash` (peppered SHA-256) |
| `user_agent` | Store full (not PII by itself) |
| `license_nonce` | Store full (not user-identifiable) |

---

## 3. Digital Signatures for Compliance Receipts

### 3.1 Existing Patterns (Webhook Signatures)

**Polar Webhook:**
```typescript
// Verification in polar-webhook-verify.ts
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}
```

**Stripe Webhook:**
```typescript
// stripe-webhook-verify.ts
export function verifyStripeWebhook(rawBody: string, signature: string, secret: string): Stripe.Event | null {
  const stripe = new Stripe(secret, { apiVersion: '2023-10-16' })
  return stripe.webhooks.constructEvent(rawBody, signature, secret, 300)
}
```

### 3.2 Top 5 Digital Signature Patterns

#### Pattern 1: HMAC-Based Receipt Signature (Recommended for ROIaaS)

**Why HMAC?** Fast, standard, no certificate management overhead

```typescript
// lib/audit/receipt-signature.ts
export interface ComplianceReceipt {
  receiptId: string
  auditLogId: string
  action: AuditAction
  licenseNonce: string
  timestamp: number
  actorId: string
  actorIPHash: string
  signature: string  // HMAC-SHA256
}

export function createReceipt(logId: string, action: AuditAction): ComplianceReceipt {
  const auditLog = await getAuditLog(logId)

  const payload = JSON.stringify({
    auditLogId: logId,
    action,
    licenseNonce: auditLog.license_nonce,
    timestamp: auditLog.created_at,
    actorId: auditLog.user_id ?? 'system',
    actorIPHash: auditLog.ip_hash  // Pre-computed
  })

  return {
    receiptId: randomUUID(),
    auditLogId: logId,
    action,
    licenseNonce: auditLog.license_nonce,
    timestamp: Math.floor(Date.now() / 1000),
    actorId: auditLog.user_id ?? 'system',
    actorIPHash: auditLog.ip_hash,
    signature: createHmac('sha256', process.env.RECEIPT_SIGNING_KEY!)
      .update(payload)
      .digest('hex')
  }
}
```

**Verification:**
```typescript
export function verifyReceipt(receipt: ComplianceReceipt): boolean {
  const payload = JSON.stringify({
    auditLogId: receipt.auditLogId,
    action: receipt.action,
    licenseNonce: receipt.licenseNonce,
    timestamp: receipt.timestamp,
    actorId: receipt.actorId,
    actorIPHash: receipt.actorIPHash
  })

  const expected = createHmac('sha256', process.env.RECEIPT_SIGNING_KEY!)
    .update(payload)
    .digest('hex')

  return timingSafeEqual(
    Buffer.from(receipt.signature),
    Buffer.from(expected)
  )
}
```

---

#### Pattern 2: ECDSA Certificate-Based Signing (Enterprise)

**Use Case:** Legal evidence, court-admissible proof

```typescript
import * as crypto from 'crypto'

export interface CertificateBasedReceipt {
  receiptId: string
  auditLogId: string
  timestamp: number
  certificate: string  // X.509 certificate (PEM)
  signature: string    // ECDSA signature (base64)
  publicKey: string    // ECDSA public key (PEM)
}

export function signWithCertificate(
  logId: string,
  certPath: string,
  keyPath: string
): CertificateBasedReceipt {
  const cert = fs.readFileSync(certPath, 'utf8')
  const privateKey = fs.readFileSync(keyPath, 'utf8')

  const data = JSON.stringify({ logId, timestamp: Math.floor(Date.now() / 1000) })

  const signer = crypto.createSign('SHA256withECDSA')
  signer.update(data)
  signer.end()

  const signature = signer.sign(privateKey, 'base64')

  return {
    receiptId: randomUUID(),
    auditLogId: logId,
    timestamp: Math.floor(Date.now() / 1000),
    certificate: cert,
    signature,
    publicKey: cert  // Public key embedded in certificate
  }
}

export function verifyCertificateSign(receipt: CertificateBasedReceipt): boolean {
  const verifier = crypto.createVerify('SHA256withECDSA')

  const data = JSON.stringify({
    logId: receipt.auditLogId,
    timestamp: receipt.timestamp
  })

  verifier.update(data)
  verifier.end()

  return verifier.verify(receipt.certificate, Buffer.from(receipt.signature, 'base64'))
}
```

**Certificate Management:**
```bash
# Generate self-signed certificate for signing
openssl req -x509 -newkey ec:<(openssl ecparam -name prime256v1) \
  -keyout audit-signing-key.pem \
  -out audit-signing-cert.pem \
  -days 365 \
  -nodes \
  -subj "/CN=ROIaaS Audit Signing/O=Sophia AI Factory"

# Verify certificate
openssl verify -CAfile audit-signing-cert.pem audit-signing-cert.pem
```

---

#### Pattern 3: JWT-Based Audit Receipt (Stateless Verification)

**Use Case:** Distribute receipts to clients for self-verification

```typescript
import { SignJWT } from 'jose'

export interface AuditReceiptJWT {
  auditLogId: string
  action: AuditAction
  licenseNonce: string
  actorId: string
  iat: number
  exp: number  // Short-lived (1 hour)
}

export async function createAuditJWT(receipt: AuditReceiptJWT): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_AUDIT_SECRET!)

  return await new SignJWT(receipt)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)
}

export async function verifyAuditJWT(token: string): Promise<AuditReceiptJWT | null> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_AUDIT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    return payload as AuditReceiptJWT
  } catch {
    return null
  }
}
```

**JWT Payload Structure:**
```json
{
  "auditLogId": "uuid",
  "action": "VALIDATE",
  "licenseNonce": "xxx",
  "actorId": "user-uuid",
  "iat": 1234567890,
  "exp": 1234567890
}
```

---

#### Pattern 4: Multi-Signature Receipt (Major Operations)

**Use Case:** Critical operations require multiple approvals

```typescript
export interface MultiSigReceipt {
  receiptId: string
  operation: string
  payloadHash: string
  signatures: {
    signerId: string
    signerType: 'ADMIN' | 'AUDITOR' | 'COMPLIANCE_OFFICER'
    signature: string
    timestamp: number
  }[]
}

export async function collectMultiSig(
  operation: string,
  payload: any
): Promise<MultiSigReceipt> {
  const payloadHash = createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')

  const requiredSigners = process.env.REQUIRED_SIGNERS?.split(',') || []

  const signatures: MultiSigReceipt['signatures'] = []

  for (const signer of requiredSigners) {
    const sig = createHmac('sha256', process.env[`SIGNER_KEY_${signer}!`])
      .update(payloadHash)
      .digest('hex')

    signatures.push({
      signerId: signer,
      signerType: signer.startsWith('auditor') ? 'AUDITOR' : 'ADMIN',
      signature: sig,
      timestamp: Math.floor(Date.now() / 1000)
    })
  }

  return {
    receiptId: randomUUID(),
    operation,
    payloadHash,
    signatures
  }
}

export function verifyMultiSig(receipt: MultiSigReceipt): boolean {
  const computedHash = createHash('sha256')
    .update(receipt.payload)
    .digest('hex')

  if (computedHash !== receipt.payloadHash) return false

  const required = parseInt(process.env.REQUIRED_SIGNATURES || '2')
  const validCount = receipt.signatures.filter(sig => {
    const expected = createHmac('sha256', getSignerKey(sig.signerId))
      .update(receipt.payloadHash)
      .digest('hex')

    return timingSafeEqual(
      Buffer.from(sig.signature),
      Buffer.from(expected)
    )
  }).length

  return validCount >= required
}
```

---

#### Pattern 5: Proof of Retention (Long-term Compliance)

**Use Case:**证明 logs were preserved for required period

```typescript
export interface ProofOfRetention {
  retentionId: string
  logIds: string[]
  retentionPeriod: number  // days
  archiveTimestamp: number
  cryptographicTimestamp: string  // RFC 3161 hash
  hashChain: string[]  // Chain of previous proofs
}

export async function createRetentionProof(
  logIds: string[],
  retentionDays: number
): Promise<ProofOfRetention> {
  const sortedHashes = logIds
    .sort()
    .map(id => createHash('sha256').update(id).digest('hex'))

  const archiveHash = createHash('sha256')
    .update(sortedHashes.join(''))
    .digest('hex')

  // Get timestamp from RFC 3161 service
  const timestampData = await getRFC3161TimestampData(archiveHash)

  // Get previous proof (for chain)
  const previousProof = await getLastRetentionProof()

  return {
    retentionId: randomUUID(),
    logIds,
    retentionPeriod: retentionDays,
    archiveTimestamp: Math.floor(Date.now() / 1000),
    cryptographicTimestamp: timestampData.timestamp,
    hashChain: previousProof
      ? [...previousProof.hashChain, previousProof.retentionId]
      : []
  }
}

export async function verifyRetentionProof(proof: ProofOfRetention): Promise<boolean> {
  // Verify hash chain integrity
  for (let i = 1; i < proof.hashChain.length; i++) {
    const current = proof.hashChain[i]
    const previous = proof.hashChain[i - 1]

    const computed = createHash('sha256')
      .update(previous)
      .digest('hex')

    if (current !== computed) return false
  }

  return true
}
```

---

## 4. Integration Strategies with RaaS Gateway

### 4.1 Current RaaS Gateway Architecture

```
Client ─X-RaaS-License-Key──> Middleware (raas-gate.ts)
                              │
                              ├─ parseLicenseKey() → raas-service.ts
                              ├─ verifyHmac() → HMAC-SHA256
                              ├─ checkExpiration()
                              ├─ checkNonce() (Redis → Supabase)
                              └─ checkRevocation()
```

### 4.2 Compliance Enhancement Plan

#### Step 1:Audit Log Enhanced with Hash Chain

**Database Migration:**
```sql
-- Add hash chain columns
ALTER TABLE raas_audit_logs
  ADD COLUMN content_hash TEXT NOT NULL DEFAULT '',
  ADD COLUMN previous_log_hash TEXT,
  ADD COLUMN hash_chain_valid BOOLEAN DEFAULT true;

-- Create index for hash verification
CREATE INDEX idx_audit_logs_content_hash ON raas_audit_logs(content_hash);

-- Create index for hash chain traversal
CREATE INDEX idx_audit_logs_hash_chain ON raas_audit_logs(previous_log_hash);

-- Enable RLS for audit logs (admin-only)
ALTER TABLE raas_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON raas_audit_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert audit logs"
  ON raas_audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```

#### Step 2:Post-Insert Hash Chain Trigger

```sql
-- Trigger function to build hash chain
CREATE OR REPLACE FUNCTION update_hash_chain()
RETURNS TRIGGER AS $$
DECLARE
  prev_hash TEXT;
BEGIN
  -- Get previous log's content_hash
  SELECT content_hash INTO prev_hash
  FROM raas_audit_logs
  WHERE created_at < NEW.created_at
  ORDER BY created_at DESC
  LIMIT 1;

  -- Build this log's content_hash
  NEW.content_hash = encode(
    digest(
      NEW.action || NEW.license_nonce || NEW.user_id::text ||
      NEW.ip_address || NEW.created_at::text || COALESCE(prev_hash, ''),
      'sha256'
    ),
    'hex'
  );

  NEW.previous_log_hash = prev_hash;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_hash_chain
  BEFORE INSERT ON raas_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_hash_chain();
```

#### Step 3:Middleware Integration

**Modified Middleware Flow:**
```typescript
// lib/raas-gate-compliance.ts
import { logAuditActionImmutable } from '@/lib/audit/immutable-store'
import { createReceipt } from '@/lib/audit/receipt-signature'

export async function raasGateCompliance(request: NextRequest): Promise<{
  valid: boolean
  response?: NextResponse
  tier?: string
  receipt?: string  // Signed JWT receipt
}> {
  const licenseKey = extractLicenseKey(request)
  const result = await validateLicenseKey(licenseKey)

  if (!result.valid) {
    // Log failed validation with immutable store
    await logAuditActionImmutable({
      action: 'VALIDATE',
      nonce: licenseKey ? licenseKey : 'unknown',
      tier: 'unknown',
      timestamp: Math.floor(Date.now() / 1000),
      userId: null,
      ipAddress: request.headers.get('x-forwarded-for') ?? null,
      userAgent: request.headers.get('user-agent') ?? null,
      details: { success: false, reason: result.reason }
    })

    return {
      valid: false,
      response: createForbiddenResponse(result.reason!)
    }
  }

  // Log successful validation
  await logAuditActionImmutable({
    action: 'VALIDATE',
    nonce: licenseKey!,
    tier: result.tier!,
    timestamp: Math.floor(Date.now() / 1000),
    userId: request.headers.get('x-logged-in-user-id'),
    ipAddress: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
    details: { success: true }
  })

  // Generate compliance receipt (JWT)
  const receipt = await createAuditJWT({
    auditLogId: 'auto-generated',
    action: 'VALIDATE',
    licenseNonce: licenseKey!,
    actorId: 'system',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  })

  return {
    valid: true,
    tier: result.tier,
    receipt
  }
}
```

### 4.3 API Endpoint Additions

**New Admin Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/audit/receipt` | GET | Get signed receipt for log |
| `/api/admin/audit/verify-receipt` | POST | Verify receipt signature |
| `/api/admin/audit/hash-chain` | GET | Verify hash chain integrity |
| `/api/admin/audit/retention-proof` | GET | Get proof of retention |
| `/api/admin/audit/timestamp` | GET | Get RFC 3161 timestamp |

**Implementation Example:**
```typescript
// apps/sophia-ai-factory/src/app/api/admin/audit/hash-chain/route.ts
export async function GET(request: NextRequest) {
  const authError = checkAdminAuth(request)
  if (authError) return authError

  const { searchParams } = request.nextUrl
  const nonce = searchParams.get('nonce')
  const since = searchParams.get('since') ? parseInt(searchParams.get('since')!) : 0

  const { data: logs } = await supabase
    .from('raas_audit_logs')
    .select('*')
    .eq('license_nonce', nonce)
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  // Verify hash chain
  let valid = true
  let previousHash: string | null = null

  for (const log of logs) {
    const computedHash = computeLogHash(log, previousHash)
    if (log.content_hash !== computedHash) {
      valid = false
      break
    }
    previousHash = computedHash
  }

  return NextResponse.json({
    nonce,
    logCount: logs?.length ?? 0,
    chainValid: valid,
    startHash: logs?.[0]?.content_hash ?? null,
    endHash: logs?.[logs.length - 1]?.content_hash ?? null
  })
}
```

---

## 5. ROIaaS Phase 6 Certification Requirements

### 5.1 Compliance Requirements Matrix

| Requirement | SOC 2 Trust Principle | Implementation Status | Priority |
|-------------|----------------------|----------------------|----------|
| **CC6.1** Access controls | Security | ✅ Complete | - |
| **CC6.6** System boundaries | Security | ✅ Complete | - |
| **CC6.7** Shared keys | Security | ✅ Complete | - |
| **CC6.8** Network security | Security | ✅ Complete | - |
| **CC7.1** Monitoring | Availability | ✅ Complete | - |
| **CC7.2** Anomaly detection | Security | ⚠️ Partial | P1 |
| **A1.1** lnput validation | Security | ⚠️ Partial | P1 |
| **A1.2** Output encoding | Security | ⚠️ Partial | P2 |
| **A2.1** Cryptographic controls | Confidentiality | ⚠️ Enhance | P1 |
| **A2.2** Key management | Confidentiality | ⚠️ Enhance | P2 |

### 5.2 Phase 6 Implementation Roadmap

#### Phase 6.1: Hash Chain Foundation (Week 1)

| Task | Files | Status |
|------|-------|--------|
| Add `previous_log_hash` column | Migration SQL | 🟡 Planned |
| Create hash chain trigger | Database function | 🟡 Planned |
| Implement hash verification | `audit/verify-hash-chain.ts` | 🟡 Planned |
| Audit log API endpoint | `api/admin/audit/hash-chain/route.ts` | 🟡 Planned |

#### Phase 6.2: Receipt System (Week 2)

| Task | Files | Status |
|------|-------|--------|
| JWT receipt generation | `audit/receipt-signature.ts` | 🟡 Planned |
| Receipt verification utility | `audit/verify-receipt.ts` | 🟡 Planned |
| Admin receipt endpoint | `api/admin/audit/receipt/route.ts` | 🟡 Planned |
| Frontend receipt display | Compliance UI component | 🟡 Planned |

#### Phase 6.3: Enhanced Time Stamping (Week 3)

| Task | Files | Status |
|------|-------|--------|
| RFC 3161 timestamp integration | `audit/timestamp-service.ts` | 🟡 Planned |
| Retention proof generation | `audit/retention-proof.ts` | 🟡 Planned |
| Archive endpoint | `api/admin/audit/archive/route.ts` | 🟡 Planned |

### 5.3 Verification Commands

```bash
# Verify hash chain integrity
PSQL_CMD="psql \"$(npx supabase db url)\""
$PSQL_CMD -c "SELECT * FROM audit_hash_chain_verify();"

# Check audit log count by day
$PSQL_CMD -c "SELECT DATE(TO_TIMESTAMP(created_at)) as day, COUNT(*) FROM raas_audit_logs GROUP BY 1 ORDER BY 1 DESC;"

# Verify timestamp retention
$PSQL_CMD -c "SELECT * FROM raas_audit_logs WHERE created_at > EXTRACT(EPOCH FROM (NOW() - INTERVAL '90 days'))::BIGINT;"

# Check for logs without hash chain
$PSQL_CMD -c "SELECT COUNT(*) FROM raas_audit_logs WHERE content_hash = '' OR content_hash IS NULL;"
```

---

## 6. Recommended Libraries (TypeScript/Node.js)

### 6.1 Core Cryptography

| Library | Purpose | Status |
|---------|---------|--------|
| `node:crypto` | HMAC-SHA256, AES-256-GCM | ✅ Native |
| `@noble/hashes` | Fast SHA-256, BLAKE2b | ⚠️ Advanced |
| `jose` | JWT signing/verification | ⚠️ Recommended |
| `"crypto-es"` | Cross-platform crypto | ⚠️ Optional |

### 6.2 Time Stamping (RFC 3161)

| Service | API | Cost |
|---------|-----|------|
| DigiCert TSA | https://timestamp.digicert.com | Paid |
| Sectigo TSA | https://sealentrust.sectigo.com | Paid |
| EJBCA (self-hosted) | Opensource | Free |
| Verisign TSA | https://timestamp.geotrust.com | Paid |

### 6.3 Database Extensions

| Extension | Purpose | Supabase |
|-----------|---------|----------|
| `pgcrypto` | Hash functions | ✅ Default |
| `pgcrypto-extensions` | Advanced crypto | 🟡 Request |
| `pg_cron` | Scheduled jobs | 🟡 Request |
| `pg_trgm` | Text search | ✅ Available |

---

## 7. Testing Strategy

### 7.1 Unit Tests

```typescript
// __tests__/audit/verify-hash-chain.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { computeHashChain, verifyHashChain } from '@/lib/audit/verify-hash-chain'

describe('Hash Chain Verification', () => {
  it('should verify valid hash chain', async () => {
    const logs = [
      { created_at: 1000, content: 'login' },
      { created_at: 1001, content: 'validate', previous_hash: '...' }
    ]

    const verified = verifyHashChain(logs)
    expect(verified).toBe(true)
  })

  it('should detect tampered log', async () => {
    const logs = [
      { created_at: 1000, content: 'login', content_hash: 'abc' },
      { created_at: 1001, content: 'MODIFIED', previous_hash: 'abc' }
    ]

    const verified = verifyHashChain(logs)
    expect(verified).toBe(false)
  })
})
```

### 7.2 Integration Tests

```typescript
// __tests__/audit/integration.test.ts
describe('Compliance Audit Integration', () => {
  it('should create immutable audit trail', async () => {
    // 1. Create license
    const license = await createLicense('premium')

    // 2. Simulate validation
    await validateLicense(license.key)

    // 3. Verify audit trail
    const trail = await getAuditTrail(license.nonce)
    expect(trail.length).toBeGreaterThan(0)

    // 4. Verify hash chain
    expect(trail[0].previous_hash).toBeNull()
    for (let i = 1; i < trail.length; i++) {
      expect(trail[i].previous_hash).toBe(trail[i-1].content_hash)
    }
  })
})
```

---

## 8. unresolved Questions

### 8.1 Technical Questions

1. **RFC 3161 Time Stamping:** Should we use a paid service (DigiCert, Verisign) or self-host EJBCA? Cost analysis needed.

2. **Certificate vs HMAC:** Is HMAC-SHA256 sufficient for legal evidence, or do we need full certificate-based signing (ECDSA)?

3. **Merkle Tree vs Linear Chain:** For audit logs, is a linear hash chain sufficient (simpler), or do we need Merkle trees (supports partial verification)?

4. **Expiration Policy:** What's the required retention period? SOC 2 = 5 years, GDPR = 7 years for legal claims. Current 90 days appears insufficient.

### 8.2 Business Questions

1. **Compliance Cost:** What's the budget for Phase 6 certification? (Time-stamping service, certificate management, audit preparation)

2. **Self-Attestation vs External Audit:** Will Sophia self-attest SOC 2, or require external auditor?

3. **Client Access:** Should customers be able to verify their own audit logs? If yes, what UI is required?

### 8.3 Missing Research Items

1. ** deviations:** Document any skipped patterns and justification

2. **Alternative Solutions:** Research alternative to RFC 3161 (blockchain timestamping, Ethereum smart contracts for immutable logs)

3. **Regional Requirements:** Does Vietnam have specific data sovereignty requirements affecting audit log storage?

---

## Appendix A: Code Examples Summary

### A.1 Hash-Enhanced Audit Log Schema

```typescript
export interface AuditLogWithHash {
  id: string
  action: AuditAction
  license_nonce: string
  user_id: string | null
  ip_hash: string  // Salted SHA-256
  user_agent: string | null
  content_hash: string  // SHA-256 of all above + previous_hash
  previous_log_hash: string | null
  hash_chain_valid: boolean
  created_at: number
}
```

### A.2 Receipt Generation

```typescript
export async function createSignedReceipt(logId: string): Promise<ReceiptJWT> {
  const log = await getAuditLog(logId)

  return await new SignJWT({
    auditLogId: logId,
    action: log.action,
    licenseNonce: log.license_nonce,
    actorId: log.user_id ?? 'system',
    actorIPHash: log.ip_hash,
    contentHash: log.content_hash
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(process.env.RECEIPT_SECRET!))
}
```

### A.3 Hash Chain Verification

```typescript
export function verifyHashChain(logs: AuditLogWithHash[]): boolean {
  let valid = true
  let previousHash: string | null = null

  for (const log of logs) {
    if (previousHash && log.previous_log_hash !== previousHash) {
      valid = false
      break
    }

    const expectedHash = sha256(
      JSON.stringify({
        action: log.action,
        license_nonce: log.license_nonce,
        user_id: log.user_id,
        ip_hash: log.ip_hash,
        previous_hash: log.previous_log_hash
      })
    )

    if (log.content_hash !== expectedHash) {
      valid = false
      break
    }

    previousHash = expectedHash
  }

  return valid
}
```

---

## Appendix B: References

### B.1 Standards

- SOC 2 Type II - AICPA Trust Services Criteria
- GDPR Article 17 - Right to Erasure
- RFC 3161 - Internet Timestamping
- NIST SP 800-90B - Cryptographic Randomness

### B.2 Documentation

- [SHA-256 Implementation Guide - NIST](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-2.pdf)
- [HMAC Using SHA-256 - RFC 6234](https://datatracker.ietf.org/doc/html/rfc6234)
- [JWT Best Practices - RFC 7519](https://datatracker.ietf.org/doc/html/rfc7519)

### B.3 Tools

- [node:crypto Documentation](https://nodejs.org/api/crypto.html)
- [jose Library](https://github.com/panva/jose)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

**Report Version:** 1.0
**Last Updated:** 2026-03-08
**Prepared By:** Researcher Agent
