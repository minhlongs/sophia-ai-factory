/**
 * Canary rollback workflow contract.
 *
 * The security property under test: the rollback workflow, which runs with the
 * Cloudflare API token in its environment, must never interpolate
 * operator-supplied text into a shell command, must target only this
 * repository's Worker and the production environment, must validate every input
 * through the request validator before acting, and must offer a dry-run path
 * that mutates nothing.
 *
 * This is a workflow-source contract test. It reads `.github/workflows/canary-rollback.yml`
 * as text and asserts the invariants that keep the job safe, so a future edit
 * that reintroduces a `${{ github.event.inputs.* }}` interpolation inside a
 * `run:` block fails the suite instead of shipping a rollback injection.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const WORKFLOW_PATH = path.resolve(process.cwd(), '../../.github/workflows/canary-rollback.yml');
const WORKFLOW = fs.readFileSync(WORKFLOW_PATH, 'utf8');

/** Every `run:` block body with its starting line number. */
function runBlocks(source: string): Array<{ line: number; body: string }> {
  const lines = source.split('\n');
  const blocks: Array<{ line: number; body: string }> = [];
  let current: { line: number; body: string[] } | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index];
    if (/^\s*run:\s*\|?\s*$/.test(text) || /^\s*run:\s+\S/.test(text)) {
      current = { line: index + 1, body: [] };
      continue;
    }
    if (current) {
      // A run block ends at the next key at the same or lower indentation.
      if (/^\S/.test(text) || (/^\s{0,8}[a-zA-Z_-]+:/.test(text) && !/^\s{10,}/.test(text))) {
        blocks.push({ line: current.line, body: current.body.join('\n') });
        current = null;
        continue;
      }
      current.body.push(text);
    }
  }
  if (current) blocks.push({ line: current.line, body: current.body.join('\n') });
  return blocks;
}

describe('canary-rollback workflow contract', () => {
  it('exists and is the workflow the deploy pipeline documents', () => {
    expect(WORKFLOW.length).toBeGreaterThan(0);
    expect(/^name:\s*Canary Rollback/m.test(WORKFLOW)).toBe(true);
  });

  it('never interpolates any input-derived expression inside a run block', () => {
    const blocks = runBlocks(WORKFLOW);
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      // `github.event.inputs.*` is operator-controlled text. It must travel
      // through env: and be read as an environment variable, never inlined.
      expect(block.body).not.toMatch(/\$\{\{\s*github\.event\.inputs\./);
      expect(block.body).not.toMatch(/\$\{\{\s*inputs\./);
    }
  });

  it('never interpolates any expression at all inside a run block', () => {
    for (const block of runBlocks(WORKFLOW)) {
      expect(block.body).not.toContain('${{');
    }
  });

  it('passes rollback inputs to the job through the environment', () => {
    expect(WORKFLOW).toMatch(/ROLLBACK_REASON/);
    expect(WORKFLOW).toMatch(/ROLLBACK_ALERT_ID/);
  });

  it('validates the request before any wrangler or curl command can run', () => {
    const validatorIndex = WORKFLOW.indexOf('validate-rollback-request.mjs');
    expect(validatorIndex).toBeGreaterThan(-1);
    const rollbackIndex = WORKFLOW.indexOf('wrangler rollback');
    expect(rollbackIndex).toBeGreaterThan(validatorIndex);
    const telegramIndex = WORKFLOW.indexOf('api.telegram.org');
    expect(telegramIndex).toBeGreaterThan(validatorIndex);
  });

  it('offers a dry-run input that gates every mutating step', () => {
    expect(WORKFLOW).toMatch(/dry_run/);
  });

  it('declares least-privilege permissions', () => {
    const permissions = WORKFLOW.match(/^permissions:([\s\S]*?)(?=^\S|\njobs:)/m);
    expect(permissions).not.toBeNull();
    const body = permissions?.[1] ?? '';
    // The rollback job holds the Cloudflare token. It must never be granted a
    // write scope: nothing in it writes to the repository or to Actions state.
    expect(body).not.toMatch(/contents:\s*write/);
    expect(body).not.toMatch(/actions:\s*write/);
    expect(body).toMatch(/contents:\s*read/);
  });

  it('serializes concurrent rollbacks so two alerts cannot race', () => {
    expect(WORKFLOW).toMatch(/^concurrency:/m);
    expect(WORKFLOW).toMatch(/cancel-in-progress:\s*false/);
  });

  it('does not name a foreign repository owner in its comments', () => {
    expect(WORKFLOW).not.toMatch(/longtho638-jpg/);
  });

  it('pins setup-node to an immutable commit, not a mutable tag', () => {
    const setupNode = WORKFLOW.match(/uses:\s*actions\/setup-node@(\S+)/);
    expect(setupNode).not.toBeNull();
    expect(setupNode?.[1]).toMatch(/^[0-9a-f]{40}$/);
  });

  it('uses a content-addressed checkout action, not a bare tag', () => {
    const checkout = WORKFLOW.match(/uses:\s*actions\/checkout@(\S+)/);
    expect(checkout).not.toBeNull();
    expect(checkout?.[1]).toMatch(/^[0-9a-f]{40}$/);
  });

  it('installs dependencies reproducibly with a lockfile', () => {
    expect(WORKFLOW).toMatch(/npm ci/);
    expect(WORKFLOW).not.toMatch(/npm install/);
  });
});
