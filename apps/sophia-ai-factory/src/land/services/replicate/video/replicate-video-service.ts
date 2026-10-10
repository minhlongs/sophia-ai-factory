import { IVideoService, CreateVideoParams, VideoStatus, Avatar, Voice } from '../../types';
import { logger } from '@/seed/utils/logger-utility';
import { ReplicateVideoServiceConfig } from './types';
import { submitPrediction } from './model-dispatcher';
import { pollPrediction } from './prediction-poller';

const DEFAULT_BASE_URL = 'https://api.replicate.com/v1';
const DEFAULT_MODEL_OWNER = 'devxpy';
const DEFAULT_MODEL_NAME = 'wav2lip';
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export class ReplicateVideoService implements IVideoService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly modelOwner: string;
  private readonly modelName: string;
  private readonly timeoutMs: number;
  private readonly keyRef?: string;

  constructor(config: ReplicateVideoServiceConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.modelOwner = config.modelOwner ?? DEFAULT_MODEL_OWNER;
    this.modelName = config.modelName ?? DEFAULT_MODEL_NAME;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.keyRef = config.keyRef;
  }

  async createVideo(params: CreateVideoParams, keyRef?: string): Promise<string> {
    const effectiveKeyRef = keyRef ?? this.keyRef;
    const input: Record<string, unknown> = {
      face: params.avatarId,
      audio: params.voiceId,
    };

    logger.info('[ReplicateVideoService] Submitting Wav2Lip prediction', {
      model: `${this.modelOwner}/${this.modelName}`,
      hasFace: !!params.avatarId,
      hasAudio: !!params.voiceId,
      title: params.title,
      keyRef: effectiveKeyRef,
    });

    return submitPrediction({
      baseUrl: this.baseUrl,
      modelOwner: this.modelOwner,
      modelName: this.modelName,
      apiKey: this.apiKey,
      timeoutMs: this.timeoutMs,
      input,
      keyRef: effectiveKeyRef,
    });
  }

  async getVideoStatus(videoId: string, keyRef?: string): Promise<VideoStatus> {
    return pollPrediction({
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      videoId,
      timeoutMs: this.timeoutMs,
      keyRef: keyRef ?? this.keyRef,
    });
  }

  async listAvatars(): Promise<Avatar[]> {
    return [];
  }

  async listVoices(): Promise<Voice[]> {
    return [];
  }
}
