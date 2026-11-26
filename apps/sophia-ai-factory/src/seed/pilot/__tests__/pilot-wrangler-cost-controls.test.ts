/**
 * @vitest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { resolvePilotCostControls, type PilotEnvSource } from '../pilot-access-policy';

function parseWranglerVars(tomlContent: string): PilotEnvSource {
  const varsMatch = tomlContent.match(/\[vars\]([\s\S]*?)(\n\[|$)/);
  const block = varsMatch?.[1] ?? '';
  const out: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"([^"]*)"\s*$/);
    if (m) {
      out[m[1]] = m[2];
    }
  }
  return out as PilotEnvSource;
}

describe('Anti-domino guard: wrangler.pilot.toml [vars] vs resolvePilotCostControls()', () => {
  it('validates the live wrangler.pilot.toml [vars] without PILOT_COST_CONTROLS_UNCONFIGURED', () => {
    const tomlPath = path.resolve(process.cwd(), 'wrangler.pilot.toml');
    const content = fs.readFileSync(tomlPath, 'utf8');
    const pilotVars = parseWranglerVars(content);

    const validation = resolvePilotCostControls(pilotVars);
    expect(validation.ok).toBe(true);
  });
});
