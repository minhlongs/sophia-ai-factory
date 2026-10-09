/**
 * @file claim-builder.ts
 * @description Constructs C2PA standard claim assertions and ingredients for AI-generated assets.
 * @layer tree
 */

import {
  C2PA_CLAIM_GENERATOR_DEFAULT,
  C2PA_DEFAULT_SIGNER_IDENTITY,
  type C2paAssertion,
  type C2paClaim,
  type C2paIngredient,
  type CreateC2paManifestInput,
} from '@/seed/types/creator-dao-c2pa';

/**
 * Constructs a C2PA standard claim object with all assertions and metadata.
 */
export function createC2paClaim(input: CreateC2paManifestInput, assetSha256: string): C2paClaim {
  const assertions: C2paAssertion[] = [
    {
      label: 'c2pa.actions',
      data: {
        actions: [
          {
            action: 'c2pa.created',
            when: new Date().toISOString(),
            softwareAgent: C2PA_CLAIM_GENERATOR_DEFAULT,
          },
          {
            action: 'c2pa.ai_generated',
            when: new Date().toISOString(),
            models: input.aiModelsUsed ?? [
              { name: 'Sophia-Video-Synthesis-Engine', version: '2.5', role: 'video_generation' },
            ],
          },
        ],
      },
    },
    {
      label: 'c2pa.ai_generation',
      data: {
        engine: 'Sophia AI Factory Video Synthesis Core 2027',
        models: input.aiModelsUsed ?? [
          { name: 'Sophia-Video-Synthesis-Engine', version: '2.5', role: 'video_generation' },
        ],
      },
    },
    {
      label: 'c2pa.hash.data',
      data: {
        assetSha256,
        format: input.format ?? 'video/mp4',
        uri: `urn:c2pa:asset:${input.assetId}`,
      },
    },
    {
      label: 'c2pa.author',
      data: {
        creatorId: input.creatorId,
        daoId: input.daoId ?? null,
        licensingContractId: input.licensingContractId ?? null,
        authority: C2PA_DEFAULT_SIGNER_IDENTITY,
      },
    },
  ];

  if (input.dubbingDetails) {
    assertions.push({
      label: 'c2pa.dubbed',
      data: {
        sourceLanguage: input.dubbingDetails.sourceLang,
        targetLanguage: input.dubbingDetails.targetLang,
        voiceModel: input.dubbingDetails.voiceModel,
      },
    });
  }

  if (input.customAssertions && input.customAssertions.length > 0) {
    for (const custom of input.customAssertions) {
      assertions.push(custom);
    }
  }

  const ingredients: C2paIngredient[] = input.ingredients ?? [];

  return {
    claimGenerator: C2PA_CLAIM_GENERATOR_DEFAULT,
    title: input.title,
    format: input.format ?? 'video/mp4',
    instanceId: `urn:c2pa:sophia:manifest:${Date.now()}:${input.assetId}`,
    assertions,
    ingredients,
    signatureAlgorithm: 'HMAC-SHA256',
  };
}
