import { IScriptService, GenerateScriptInput, ScriptOutput } from "../types";
import { generateScript as legacyGenerateScript } from "@/seed/ai/script-generator";
import type { ScriptGenDeps } from '@/seed/ai/script-generator-helpers';

type ScriptFunding = NonNullable<ScriptGenDeps['funding']>

export class RealScriptService implements IScriptService {
  constructor(private readonly funding?: ScriptFunding) {}

  async generateScript(input: GenerateScriptInput): Promise<ScriptOutput> {
    // `input.orgId` threads the tenant scope into the LLM cache (Phase 4F).
    // `input.affiliateOffer` injects CTA into the script prompt (Phase M3).
    if (this.funding) return await legacyGenerateScript(input, { funding: this.funding })
    return await legacyGenerateScript(input);
  }
}
