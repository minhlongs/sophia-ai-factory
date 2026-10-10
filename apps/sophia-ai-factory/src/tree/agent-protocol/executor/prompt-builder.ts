import type { ChatMessage } from '@/seed/ai/provider-interface';
import type {
  AgentDefinition,
  AgentContext,
  CreativeIdentity,
} from '@/seed/types/creative-domain';

/**
 * Render a compact identity block for the system prompt (Constitution §6:
 * every agent must respect workspace creative identity). Deliberately
 * truncated — voice/tone/beliefs/constraints only, no raw dumps.
 */
export function buildIdentityBlock(identity: CreativeIdentity): string {
  const lines: string[] = [
    'CREATIVE IDENTITY (must be respected in all output):',
    `- Voice: ${identity.voiceDescription}`,
    `- Tone: ${identity.tone} (formality ${identity.formality}, energy ${identity.energy})`,
  ];
  if (identity.beliefs.length > 0) {
    lines.push(`- Beliefs: ${identity.beliefs.slice(0, 5).join('; ')}`);
  }
  if (identity.positioning) {
    lines.push(`- Positioning: ${identity.positioning}`);
  }
  if (identity.targetAudience) {
    lines.push(`- Target audience: ${identity.targetAudience}`);
  }
  if (identity.forbiddenPatterns.length > 0) {
    lines.push(`- Forbidden patterns (NEVER use): ${identity.forbiddenPatterns.slice(0, 10).join('; ')}`);
  }
  if (identity.requiredDisclosures.length > 0) {
    lines.push(`- Required disclosures (MUST include): ${identity.requiredDisclosures.join('; ')}`);
  }
  return lines.join('\n');
}

/**
 * Build the chat message array for an agent run. Identity-first prompting
 * (Constitution §6): when the workspace has an active CreativeIdentity it
 * leads the prompt as a system block. Without one the legacy two-message
 * shape is preserved byte-for-byte.
 */
export function buildAgentMessages(
  definition: AgentDefinition,
  context: AgentContext,
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (context.creativeIdentity) {
    messages.push({ role: 'system', content: buildIdentityBlock(context.creativeIdentity) });
  }
  messages.push(
    { role: 'system', content: definition.role },
    { role: 'user', content: JSON.stringify(context.memory?.slice(0, 5) ?? {}) },
  );
  return messages;
}
