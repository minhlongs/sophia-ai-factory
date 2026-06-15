import { IScriptService, GenerateScriptInput, ScriptOutput } from "../types";
import { generateScript as legacyGenerateScript } from "@/seed/ai/script-generator";

export class RealScriptService implements IScriptService {
  async generateScript(input: GenerateScriptInput): Promise<ScriptOutput> {
    // `input.orgId` threads the tenant scope into the LLM cache (Phase 4F).
    // `input.affiliateOffer` injects CTA into the script prompt (Phase M3).
    return await legacyGenerateScript(input);
  }
}
