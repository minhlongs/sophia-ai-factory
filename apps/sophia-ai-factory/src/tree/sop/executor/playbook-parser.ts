/**
 * SOP Playbook Markdown Parser
 *
 * Parses playbook.md into an ordered list of ParsedSteps.
 *
 * Convention:
 *   ## Step N: command:name
 *   ```yaml
 *   key: value
 *   ```
 *
 * Step headers must match: /^## Step (\d+): ([\w:]+)/
 * YAML args are optional (step can have no code fence = empty args).
 */

import yaml from 'js-yaml';
import type { ParsedStep } from './types';

const STEP_HEADER_RE = /^## Step (\d+): ([\w:-]+)\s*$/m;
const CODE_FENCE_RE = /```yaml\r?\n([\s\S]*?)```/;

function parseStepArgs(section: string, order: number, command: string): Record<string, unknown> {
  const fenceMatch = CODE_FENCE_RE.exec(section);
  if (!fenceMatch) return {};

  try {
    const parsed = yaml.load(fenceMatch[1]);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch (e) {
    throw new Error(
      `Step ${order} (${command}): YAML args parse error: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Parse playbook.md string into ordered step list.
 * Throws if no steps found or if a step header is malformed.
 */
export function parsePlaybook(src: string): ParsedStep[] {
  // Split on ## Step headers (keep the delimiter in results)
  const sections = src.split(/(?=^## Step \d+:)/m).filter((s) => s.trim());

  const steps: ParsedStep[] = [];

  for (const section of sections) {
    const headerMatch = STEP_HEADER_RE.exec(section);
    if (!headerMatch) continue;

    const order = parseInt(headerMatch[1], 10);
    const command = headerMatch[2].trim();
    const args = parseStepArgs(section, order, command);

    steps.push({ order, command, args });
  }

  if (steps.length === 0) {
    throw new Error('playbook.md contains no valid ## Step N: command headers');
  }

  // Sort by order to ensure correct execution sequence
  steps.sort((a, b) => a.order - b.order);

  return steps;
}
