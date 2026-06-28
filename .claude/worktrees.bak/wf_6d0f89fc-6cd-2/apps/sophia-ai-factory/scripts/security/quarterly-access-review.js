#!/usr/bin/env node
/**
 * quarterly-access-review.js — SOC 2 quarterly access review report generator
 * Usage: node scripts/security/quarterly-access-review.js [--quarter Q2-2026] [--output dir]
 *
 * Generates CSV + Markdown report of users with admin/operator privileges
 * for quarterly review and sign-off by compliance officer.
 *
 * SOC 2 CC7.2: Review of logical access rights to critical systems.
 */

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const __dirname = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Parse arguments
const args = process.argv.slice(2);
const quarterArgIndex = args.indexOf('--quarter');
const outputArgIndex = args.indexOf('--output');

const quarter = quarterArgIndex !== -1 ? args[quarterArgIndex + 1] : getCurrentQuarter();
const outputDir = outputArgIndex !== -1 ? resolve(args[outputArgIndex + 1]) : resolve(__dirname, '../docs/security/access-reviews');

function getCurrentQuarter() {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `Q${q}-${now.getFullYear()}`;
}

function queryAdminUsers() {
  // Query D1 for users with admin/enterprise/master privileges
  const sql = `
    SELECT u.id, u.email, u.full_name, u.role, u.created_at, u.updated_at, up.subscription_tier
    FROM users u
    LEFT JOIN user_profiles up ON u.id = up.user_id
    WHERE u.role = 'admin'
       OR up.subscription_tier = 'enterprise'
       OR up.subscription_tier = 'master'
    ORDER BY u.updated_at DESC;
  `;

  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'sophia-raas-db', '--remote', '--command', sql.replace(/\n/g, ' '), '--json'],
    { encoding: 'utf-8', stdio: 'pipe' }
  );

  if (result.status !== 0) {
    throw new Error(`D1 query failed: ${result.stderr || result.stdout}`);
  }

  const parsed = JSON.parse(result.stdout);
  return (parsed.results || []).map((row) => ({
    userId: row.id,
    email: row.email || '',
    name: row.full_name || '',
    tier: row.subscription_tier || 'unknown',
    role: row.role || 'user',
    lastActivity: row.updated_at ? String(row.updated_at).split('T')[0] : 'never',
    reviewStatus: 'pending',
    notes: '',
  }));
}

function fetchGitHubCollaborators() {
  try {
    // Use gh CLI to fetch repo collaborators (requires authentication)
    const output = spawnSync(
      'gh',
      ['api', '-H', 'Accept: application/vnd.github+json', '/repos/longtho638-jpg/sophia-ai-factory/collaborators', '--jq', '[.[] | {login: .login, permission: .permission}]'],
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    if (output.status === 0) {
      return JSON.parse(output.stdout);
    }
  } catch {
    // gh not available or not authenticated
  }
  return [];
}

function generateMarkdown(admins, collaborators, quarter) {
  const lines = [
    `# Quarterly Access Review — ${quarter}`,
    '',
    `**Generated:** ${new Date().toISOString()}`,
    `**Database:** sophia-raas-db (remote)`,
    '',
    '## Executive Summary',
    '',
    `- Total admin/enterprise users: ${admins.length}`,
    `- GitHub collaborators (read/write): ${collaborators.length}`,
    '- Review status: Pending compliance officer sign-off',
    '',
    '## Platform Users (Admin/Enterprise Tier)',
    '',
    '| User ID | Email | Name | Tier | Role | Last Activity | Review Decision |',
    '|---------|-------|------|------|------|---------------|-----------------|',
  ];

  for (const admin of admins) {
    lines.push(
      `| ${admin.userId.slice(0, 8)}... | ${admin.email} | ${admin.name} | ${admin.tier} | ${admin.role} | ${admin.lastActivity} | ⬜ pending |`
    );
  }

  lines.push('');
  lines.push('## GitHub Collaborators');
  lines.push('');
  lines.push('| Login | Permission |');
  lines.push('|-------|------------|');

  for (const collab of collaborators) {
    lines.push(`| @${collab.login} | ${collab.permission} |`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Sign-off');
  lines.push('');
  lines.push('**Compliance Officer:** ___________________ Date: _________');
  lines.push('');
  lines.push('**CTO:** ___________________ Date: _________');
  lines.push('');
  lines.push('**Notes:**');
  lines.push('');
  lines.push('- [ ] All admin users are active and authorized');
  lines.push('- [ ] No departed employees retain access');
  lines.push('- [ ] API keys for admin services rotated if needed');
  lines.push('- [ ] GitHub collaborator list reviewed');
  lines.push('');

  return lines.join('\n');
}

function generateCSV(admins) {
  const headers = ['User ID', 'Email', 'Name', 'Tier', 'Role', 'Last Activity', 'Review Status', 'Notes'];
  const rows = admins.map((a) => [
    a.userId,
    a.email,
    a.name,
    a.tier,
    a.role,
    a.lastActivity,
    a.reviewStatus,
    a.notes,
  ]);
  return [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
}

function main() {
  console.log(`=== Quarterly Access Review — ${quarter} ===`);

  try {
    // Ensure output directory exists
    mkdirSync(outputDir, { recursive: true });

    // Fetch data
    console.log('Fetching admin users from database...');
    const admins = queryAdminUsers();
    console.log(`Found ${admins.length} admin/enterprise users`);

    console.log('Fetching GitHub collaborators...');
    const collaborators = fetchGitHubCollaborators();
    console.log(`Found ${collaborators.length} collaborators`);

    // Generate outputs
    const markdown = generateMarkdown(admins, collaborators, quarter);
    const csv = generateCSV(admins);

    // Write files
    const mdPath = resolve(outputDir, `${quarter}.md`);
    const csvPath = resolve(outputDir, `${quarter}.csv`);

    writeFileSync(mdPath, markdown);
    writeFileSync(csvPath, csv);

    console.log('\n✅ Access review generated:');
    console.log(` Markdown: ${mdPath}`);
    console.log(` CSV: ${csvPath}`);
    console.log('\nNext steps:');
    console.log('1. Review with compliance officer');
    console.log('2. Document access revocation actions');
    console.log('3. Commit this file as evidence of quarterly review');
    console.log('4. Sign off via signatures in the document');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
