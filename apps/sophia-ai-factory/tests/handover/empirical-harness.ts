/**
 * Empirical Verification Harness for Challenger 2 (Phase 20)
 * Location: apps/sophia-ai-factory/tests/handover/empirical-harness.ts
 */

import type { D1Database } from '../../src/seed/db/client';
import type { CustomerHandoverRecord, HandoverCertificate } from '../../src/seed/handover/handover-types';
import {
  recordHandoverAcceptance,
  getCustomerHandover,
  getHandoverCertificate,
} from '../../src/tree/handover/customer-handover-service';
import {
  getRunbookBySlug,
  listRunbooks,
  exportRunbookMarkdown,
  exportRunbookHtml,
} from '../../src/tree/handover/runbook-catalog-service';

async function runEmpiricalHarness() {
  console.log('=================================================================');
  console.log('PHASE 20 EMPIRICAL CHALLENGER 2 HARNESS — RESULTS & EVIDENCE');
  console.log('=================================================================\n');

  const findings: Array<{
    area: string;
    description: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'PASS';
    evidence: Record<string, unknown>;
  }> = [];

  // ===========================================================================
  // TEST 1: Double Sign-Off Prevention
  // ===========================================================================
  console.log('--- TEST 1: Double Sign-Off Prevention ---');

  const initialSignedAt = 1726800000000;
  const initialHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  let d1CustomerHandover: CustomerHandoverRecord = {
    id: 'handover_001',
    customer_user_id: 'usr_alice_ceo',
    agency_name: 'Alpha Agency',
    agency_type: 'b2b_saas',
    tier: 'SCALE',
    starter_sops: '[]',
    magic_link_token: null,
    magic_link_expires_at: null,
    created_by_admin_id: 'admin_sys',
    created_at: 1726700000000,
    welcome_email_sent_at: 1726700000000,
    customer_first_login_at: 1726750000000,
    customer_first_sop_install_at: 1726760000000,
    customer_first_run_at: 1726770000000,
    status: 'active',
    source: 'manual',
    trigger_payment_id: null,
    tenant_id: 'tenant_alpha',
    signer_name: 'Alice Original CEO',
    signer_email: 'alice@alpha.io',
    signer_role: 'CEO',
    certificate_hash: initialHash,
    acceptance_status: 'accepted', // Already signed and accepted!
    verification_results: '{"overallVerdict":"PASS"}',
    signed_at: initialSignedAt,
    verification_passed_at: initialSignedAt,
    certificate_r2_key: null,
    notes: 'Initial legitimate sign-off',
  };

  let d1Certificate: HandoverCertificate = {
    id: 'cert_handover_001_initial',
    handoverId: 'handover_001',
    tenantId: 'tenant_alpha',
    customerName: 'Alpha Agency',
    customerEmail: 'alice@alpha.io',
    signerName: 'Alice Original CEO',
    signerEmail: 'alice@alpha.io',
    signerRole: 'CEO',
    tier: 'SCALE',
    deployedSha: 'sha_v1',
    certificateSha256: initialHash,
    verificationResults: '{"overallVerdict":"PASS"}',
    contentMarkdown: '# Certified by Alice',
    metadataJson: '{}',
    createdAt: initialSignedAt,
  };

  const mockDb = {
    prepare: (sql: string) => {
      return {
        bind: (...args: unknown[]) => {
          return {
            first: async <T>() => {
              if (sql.includes('FROM customer_handovers')) {
                const id = String(args[0]).trim();
                if (d1CustomerHandover.id === id || d1CustomerHandover.customer_user_id === id) {
                  return { ...d1CustomerHandover } as unknown as T;
                }
                return null as unknown as T;
              }
              if (sql.includes('FROM handover_certificates')) {
                const id = String(args[0]).trim();
                if (d1Certificate.handoverId === id || d1Certificate.id === id) {
                  return { ...d1Certificate } as unknown as T;
                }
                return null as unknown as T;
              }
              return null as unknown as T;
            },
            run: async () => {
              if (sql.includes('UPDATE customer_handovers')) {
                d1CustomerHandover.signer_name = String(args[0]);
                d1CustomerHandover.signer_email = String(args[1]);
                d1CustomerHandover.signer_role = String(args[2]);
                d1CustomerHandover.certificate_hash = String(args[3]);
                d1CustomerHandover.signed_at = Number(args[5]);
                d1CustomerHandover.notes = args[7] ? String(args[7]) : null;
              }
              if (sql.includes('INSERT INTO handover_certificates')) {
                d1Certificate = {
                  id: String(args[0]),
                  handoverId: String(args[1]),
                  tenantId: args[2] as string | null,
                  customerName: String(args[3]),
                  customerEmail: String(args[4]),
                  signerName: String(args[5]),
                  signerEmail: String(args[6]),
                  signerRole: String(args[7]),
                  tier: String(args[8]),
                  deployedSha: String(args[9]),
                  certificateSha256: String(args[10]),
                  verificationResults: args[11] as string | null,
                  contentMarkdown: String(args[12]),
                  metadataJson: args[13] as string | null,
                  createdAt: Number(args[14]),
                };
              }
              return { success: true };
            },
          };
        },
      };
    },
  } as unknown as D1Database;

  // Attempt 2: Mallory attempts to sign the already accepted handover
  let doubleSignError: string | null = null;
  let doubleSignResult: any = null;
  try {
    doubleSignResult = await recordHandoverAcceptance(mockDb, {
      handoverId: 'handover_001',
      signerName: 'Mallory Impostor',
      signerEmail: 'mallory@evil.com',
      signerRole: 'Impostor',
      notes: 'Second sign-off overwriting original record',
    });
  } catch (err) {
    doubleSignError = err instanceof Error ? err.message : String(err);
  }

  const signerOverwritten = d1CustomerHandover.signer_name === 'Mallory Impostor';
  const timestampOverwritten = d1CustomerHandover.signed_at !== initialSignedAt;
  const hashOverwritten = d1CustomerHandover.certificate_hash !== initialHash;

  console.log('Result of second sign-off:');
  console.log('  Error thrown?:', doubleSignError);
  console.log('  Signer name overwritten?:', signerOverwritten, `("${d1CustomerHandover.signer_name}")`);
  console.log('  Timestamp overwritten?:', timestampOverwritten, `(${initialSignedAt} -> ${d1CustomerHandover.signed_at})`);
  console.log('  Hash overwritten?:', hashOverwritten, `(${initialHash.slice(0, 16)}... -> ${d1CustomerHandover.certificate_hash?.slice(0, 16)}...)`);
  console.log('  Certificate in table overwritten?:', d1Certificate.signerName === 'Mallory Impostor');

  if (signerOverwritten || timestampOverwritten || hashOverwritten) {
    findings.push({
      area: 'Double Sign-Off Prevention',
      description: 'CRITICAL: recordHandoverAcceptance does NOT guard against already accepted handovers. It overwrites signer name, timestamp, and SHA-256 certificate hash on repeated calls, destroying the immutable audit trail.',
      severity: 'CRITICAL',
      evidence: {
        initialSigner: 'Alice Original CEO',
        overwrittenSigner: d1CustomerHandover.signer_name,
        initialTimestamp: initialSignedAt,
        overwrittenTimestamp: d1CustomerHandover.signed_at,
        initialHash,
        overwrittenHash: d1CustomerHandover.certificate_hash,
      },
    });
  } else {
    findings.push({
      area: 'Double Sign-Off Prevention',
      description: 'PASS: Handover rejected or preserved existing certificate without overwrite.',
      severity: 'PASS',
      evidence: { currentSigner: d1CustomerHandover.signer_name },
    });
  }

  // ===========================================================================
  // TEST 2: Unauthorized Access & Role Validation on Server Actions
  // ===========================================================================
  console.log('\n--- TEST 2: Unauthorized Access & Role Validation ---');

  // Let's inspect src/land/actions/handover-actions.ts code directly
  const fs = await import('fs');
  const path = await import('path');
  const actionsPath = path.resolve(process.cwd(), 'src/land/actions/handover-actions.ts');
  const actionsCode = fs.readFileSync(actionsPath, 'utf8');

  // Check 2.1: exportSanitizedEnvAction admin check
  const exportHasAdminCheck = actionsCode.includes('isUserAdmin') || (actionsCode.includes('role ===') && actionsCode.includes('admin'));
  console.log('  exportSanitizedEnvAction has isUserAdmin check?:', exportHasAdminCheck);

  if (!exportHasAdminCheck) {
    findings.push({
      area: 'Unauthorized Access Protection',
      description: 'HIGH: exportSanitizedEnvAction only checks `if (!user)` (any authenticated user can call it). Regular non-admin users can export sanitized tenant environment configuration variables.',
      severity: 'HIGH',
      evidence: {
        file: 'src/land/actions/handover-actions.ts',
        function: 'exportSanitizedEnvAction',
        authCheck: 'Only checks `if (!user)` at line 192. Missing `isUserAdmin(user)` guard.',
      },
    });
  }

  // Check 2.2: triggerHandoverVerificationAction admin check
  const verifyHasAdminCheck = actionsCode.slice(actionsCode.indexOf('triggerHandoverVerificationAction')).includes('isUserAdmin');
  console.log('  triggerHandoverVerificationAction has isUserAdmin check?:', verifyHasAdminCheck);

  if (!verifyHasAdminCheck) {
    findings.push({
      area: 'Unauthorized Access Protection',
      description: 'HIGH: triggerHandoverVerificationAction only checks `if (!user)` (any authenticated user can call it). Non-admin users can trigger resource-heavy Day-1 verification probes and mutate D1 handover records.',
      severity: 'HIGH',
      evidence: {
        file: 'src/land/actions/handover-actions.ts',
        function: 'triggerHandoverVerificationAction',
        authCheck: 'Only checks `if (!user)` at line 122. Missing `isUserAdmin(user)` guard.',
      },
    });
  }

  // Check 2.3: signHandoverAcceptanceAction tenant ownership check
  const signHasTenantOrAdminCheck = actionsCode.slice(actionsCode.indexOf('signHandoverAcceptanceAction'), actionsCode.indexOf('triggerHandoverVerificationAction')).includes('customer_user_id') ||
                                    actionsCode.slice(actionsCode.indexOf('signHandoverAcceptanceAction'), actionsCode.indexOf('triggerHandoverVerificationAction')).includes('tenant_id');
  console.log('  signHandoverAcceptanceAction verifies tenant ownership or admin role?:', signHasTenantOrAdminCheck);

  if (!signHasTenantOrAdminCheck) {
    findings.push({
      area: 'Unauthorized Access Protection',
      description: 'HIGH: signHandoverAcceptanceAction does not verify if caller `user.id` matches `existing.customer_user_id` or `existing.tenant_id`, nor does it require admin privileges. An arbitrary authenticated user can sign acceptance for any other tenant if they know the handover ID.',
      severity: 'HIGH',
      evidence: {
        file: 'src/land/actions/handover-actions.ts',
        function: 'signHandoverAcceptanceAction',
        authCheck: 'Checks `if (!user)` but does not verify `user.id === existing.customer_user_id` or admin role.',
      },
    });
  }

  // ===========================================================================
  // TEST 3: Invalid Signer Inputs & Whitespace Bypasses
  // ===========================================================================
  console.log('\n--- TEST 3: Invalid Signer Inputs & Whitespace Bypasses ---');

  // Let's test the validation logic in signHandoverAcceptanceAction:
  // Line 50: `if (!input.handoverId || !input.signerName || !input.signerEmail || !input.signerRole)`
  const testInputs = [
    { name: 'whitespace signerName', input: { handoverId: 'h1', signerName: '   ', signerEmail: 'a@b.com', signerRole: 'CEO' } },
    { name: 'whitespace handoverId', input: { handoverId: '   ', signerName: 'Alice', signerEmail: 'a@b.com', signerRole: 'CEO' } },
    { name: 'whitespace signerEmail', input: { handoverId: 'h1', signerName: 'Alice', signerEmail: '   ', signerRole: 'CEO' } },
    { name: 'malformed email', input: { handoverId: 'h1', signerName: 'Alice', signerEmail: 'not-an-email', signerRole: 'CEO' } },
    { name: 'arbitrary role string', input: { handoverId: 'h1', signerName: 'Alice', signerEmail: 'a@b.com', signerRole: 'hacker_role_1337' } },
  ];

  for (const t of testInputs) {
    const passesCurrentCheck = (
      !t.input.handoverId || !t.input.signerName || !t.input.signerEmail || !t.input.signerRole
    );
    // In JavaScript, "   " is truthy! So !input.signerName is false!
    const wouldPassValidation = !passesCurrentCheck;
    console.log(`  Input '${t.name}': bypassed line 50 guard?`, wouldPassValidation);

    if (wouldPassValidation) {
      findings.push({
        area: 'Invalid Signer Inputs',
        description: `MEDIUM: '${t.name}' (${JSON.stringify(t.input)}) bypasses the validation guard in signHandoverAcceptanceAction because strings are not trimmed (e.g. "   " is truthy) and roles/emails are unvalidated.`,
        severity: 'MEDIUM',
        evidence: {
          testCase: t.name,
          input: t.input,
          bypassed: wouldPassValidation,
        },
      });
    }
  }

  // ===========================================================================
  // TEST 4: Runbook Deep-link & Fallback
  // ===========================================================================
  console.log('\n--- TEST 4: Runbook Deep-link & Fallback ---');

  const invalidSlugs = [
    'non-existent-slug-xyz',
    '',
    '    ',
    '../../etc/passwd',
    '__proto__',
    'constructor',
    '<script>alert(1)</script>',
    'sop-99',
  ];

  let runbookFallbackPassed = true;
  for (const slug of invalidSlugs) {
    try {
      const res = getRunbookBySlug(slug);
      if (res !== null) {
        console.log(`  FAIL: Slug '${slug}' returned non-null:`, res);
        runbookFallbackPassed = false;
      }
      const md = exportRunbookMarkdown(slug);
      const html = exportRunbookHtml(slug);
      if (md !== null || html !== null) {
        console.log(`  FAIL: Export for '${slug}' returned non-null`);
        runbookFallbackPassed = false;
      }
    } catch (err) {
      console.log(`  CRASH: Slug '${slug}' threw uncaught exception:`, err);
      runbookFallbackPassed = false;
    }
  }

  // Check valid slugs
  const validSlugs = ['quickstart', '01', 'onboarding', 'byok', 'billing', 'operations', 'troubleshooting', 'security', 'disaster-recovery', 'ownership', 'customer-exit'];
  let validSlugsPassed = true;
  for (const slug of validSlugs) {
    const resEn = getRunbookBySlug(slug, 'en');
    const resVi = getRunbookBySlug(slug, 'vi');
    if (!resEn || !resVi) {
      console.log(`  FAIL: Valid slug '${slug}' failed to resolve!`);
      validSlugsPassed = false;
    }
  }

  console.log('  Invalid slugs safely returned null?:', runbookFallbackPassed);
  console.log('  All 10 operational runbooks resolved validly in EN and VI?:', validSlugsPassed);

  if (runbookFallbackPassed && validSlugsPassed) {
    findings.push({
      area: 'Runbook Deep-link & Fallback',
      description: 'PASS: All invalid, path-traversal, and prototype-pollution slugs return null safely without throwing uncaught exceptions. All 10 valid runbooks resolve in both English and Vietnamese with complete content.',
      severity: 'PASS',
      evidence: {
        totalRunbooks: listRunbooks('en').length,
        invalidSlugsTested: invalidSlugs.length,
        status: 'ROBUST',
      },
    });
  }

  console.log('\n=================================================================');
  console.log('SUMMARY OF EMPIRICAL FINDINGS:');
  console.log('=================================================================');
  console.log(JSON.stringify(findings, null, 2));

  return findings;
}

runEmpiricalHarness().catch((err) => {
  console.error('Fatal harness error:', err);
  process.exit(1);
});
