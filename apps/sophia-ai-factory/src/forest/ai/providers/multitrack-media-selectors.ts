/**
 * @module forest/ai/providers/multitrack-media-selectors
 * Image and video provider selection helpers for multi-track provider factory.
 */

import type {
  ImageGenerationProvider,
  IVideoRenderingProvider,
} from '@/seed/ai/multimodal-provider-interface';
import { FalImageProvider } from '@/seed/ai/providers/fal-image-provider';
import { ReplicateImageProvider } from './replicate-image-provider';
import { ReplicateVideoRenderingProvider } from './replicate-video-provider';
import { KlingVideoClient } from './kling-provider';
import { HunyuanVideoClient } from './hunyuan-provider';
import type { MultiTrackProviderFactoryOptions } from './types';

export function selectImageProvider(params: {
  imageProviderChoice?: MultiTrackProviderFactoryOptions['imageProviderChoice'];
  falKey: string;
  replicateKey: string;
  effectiveKeyRef: string;
}): ImageGenerationProvider {
  const { imageProviderChoice, falKey, replicateKey, effectiveKeyRef } = params;

  if (imageProviderChoice === 'replicate' && replicateKey) {
    return new ReplicateImageProvider({
      apiKey: replicateKey,
      keyRef: effectiveKeyRef,
    });
  }
  if (falKey) {
    return new FalImageProvider({
      apiKey: falKey,
      keyRef: effectiveKeyRef,
    });
  }
  if (replicateKey) {
    return new ReplicateImageProvider({
      apiKey: replicateKey,
      keyRef: effectiveKeyRef,
    });
  }
  return new FalImageProvider({
    apiKey: '',
    keyRef: effectiveKeyRef,
  });
}

export function selectVideoProvider(params: {
  videoProviderChoice?: MultiTrackProviderFactoryOptions['videoProviderChoice'];
  overrides?: MultiTrackProviderFactoryOptions['overrides'];
  klingKey: string;
  falKey: string;
  runpodKey: string;
  replicateKey: string;
  effectiveKeyRef: string;
}): IVideoRenderingProvider {
  const {
    videoProviderChoice,
    overrides,
    klingKey,
    falKey,
    runpodKey,
    replicateKey,
    effectiveKeyRef,
  } = params;

  if (
    videoProviderChoice === 'kling' ||
    (klingKey && !overrides?.replicateApiKey && videoProviderChoice !== 'hunyuan' && videoProviderChoice !== 'replicate')
  ) {
    return new KlingVideoClient({
      apiKey: klingKey || falKey,
      keyRef: effectiveKeyRef,
    });
  }
  if (
    videoProviderChoice === 'hunyuan' ||
    (runpodKey && !overrides?.replicateApiKey && videoProviderChoice !== 'replicate')
  ) {
    return new HunyuanVideoClient({
      apiKey: runpodKey,
      keyRef: effectiveKeyRef,
    });
  }
  if (overrides?.replicateApiKey || videoProviderChoice === 'replicate') {
    return new ReplicateVideoRenderingProvider({
      apiKey: replicateKey,
      keyRef: effectiveKeyRef,
    });
  }
  if (klingKey || falKey) {
    return new KlingVideoClient({
      apiKey: klingKey || falKey,
      keyRef: effectiveKeyRef,
    });
  }
  if (runpodKey) {
    return new HunyuanVideoClient({
      apiKey: runpodKey,
      keyRef: effectiveKeyRef,
    });
  }
  return new ReplicateVideoRenderingProvider({
    apiKey: replicateKey,
    keyRef: effectiveKeyRef,
  });
}
