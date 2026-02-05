import { IScriptService, GenerateScriptInput, ScriptOutput } from "../types";
import { generateScript as legacyGenerateScript } from "@/lib/ai/script-generator";

export class RealScriptService implements IScriptService {
  async generateScript(input: GenerateScriptInput): Promise<ScriptOutput> {
    // Delegate to existing implementation
    return await legacyGenerateScript(input);
  }
}
