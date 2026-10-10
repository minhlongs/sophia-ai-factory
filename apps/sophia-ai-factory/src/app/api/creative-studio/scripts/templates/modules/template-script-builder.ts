import type { BuildScriptOptions, GeneratedScript, ScriptScene } from './template-types';
import { getSceneConfigs } from './template-scene-configs';

export function buildScriptFromTemplate(opts: BuildScriptOptions): GeneratedScript {
  const { template, topic, brandName, targetDuration, tone, language } = opts;
  const isVi = language === 'vi';

  const sceneConfigs = getSceneConfigs(template.category, targetDuration, isVi);

  const scenes: ScriptScene[] = sceneConfigs.map((cfg, idx) => ({
    id: idx + 1,
    type: cfg.type,
    text: cfg.text(topic, brandName, tone, isVi),
    durationSec: cfg.duration,
    visualHint: cfg.visualHint(isVi),
  }));

  const fullScript = scenes.map((s) => s.text).join('\n\n');
  const wordCount = fullScript.split(/\s+/).filter(Boolean).length;

  return {
    id: crypto.randomUUID(),
    templateId: template.id,
    templateName: template.name,
    topic,
    brandName,
    tone,
    language,
    totalDurationSec: scenes.reduce((sum, s) => sum + s.durationSec, 0),
    scenes,
    fullScript,
    wordCount,
    createdAt: new Date().toISOString(),
  };
}
