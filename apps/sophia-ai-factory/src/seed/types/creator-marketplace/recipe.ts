import { z } from 'zod';

export const VideoRecipeSceneSchema = z.object({
  sceneNumber: z.number().int().positive(),
  durationSeconds: z.number().positive(),
  visualPrompt: z.string().min(1),
  voiceoverScript: z.string().min(1),
  onScreenText: z.string().optional(),
  transition: z.enum(['cut', 'fade', 'zoom', 'wipe', 'glitch']).default('cut'),
});
export type VideoRecipeScene = z.infer<typeof VideoRecipeSceneSchema>;

export const VideoRecipeSchema = z.object({
  version: z.literal('1.0'),
  hookStyle: z.string(),
  voiceProfile: z.string(),
  targetDurationSeconds: z.number().int().positive(),
  aspectRatio: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
  scenes: z.array(VideoRecipeSceneSchema),
  suggestedMusicMood: z.string().optional(),
});
export type VideoRecipe = z.infer<typeof VideoRecipeSchema>;
