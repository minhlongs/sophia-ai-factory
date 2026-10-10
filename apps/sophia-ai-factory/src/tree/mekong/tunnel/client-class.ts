import type {
  InferenceResult,
  InferenceTask,
  NodeHealthStatus,
  TunnelClientOptions,
} from '../types';
import {
  DEFAULT_TIMEOUT_MS,
  isCashclawTunnelUrl,
  normalizeTunnelUrl,
} from './url-utils';
import { probeEdgeTunnel } from './probe';
import { executeTunnelInference } from './inference';

/**
 * Object-oriented Client Wrapper for Mekong Cloudflare Tunnel Communication.
 */
export class MekongTunnelClient {
  private readonly tunnelUrl: string;
  private readonly bearerToken: string;
  private readonly defaultTimeoutMs: number;
  private readonly allowLocal: boolean;

  constructor(tunnelUrl: string, bearerToken: string, options: TunnelClientOptions = {}) {
    this.tunnelUrl = normalizeTunnelUrl(tunnelUrl);
    this.bearerToken = bearerToken;
    this.defaultTimeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.allowLocal = options.allowLocal ?? false;
  }

  public getTunnelUrl(): string {
    return this.tunnelUrl;
  }

  public isCashclaw(): boolean {
    return isCashclawTunnelUrl(this.tunnelUrl);
  }

  public async probe(timeoutMs?: number): Promise<NodeHealthStatus> {
    return probeEdgeTunnel(
      this.tunnelUrl,
      this.bearerToken,
      timeoutMs ?? this.defaultTimeoutMs,
      this.allowLocal,
    );
  }

  public async executeInference(
    task: InferenceTask,
    options?: TunnelClientOptions,
  ): Promise<InferenceResult> {
    return executeTunnelInference(this.tunnelUrl, this.bearerToken, task, {
      timeoutMs: options?.timeoutMs ?? this.defaultTimeoutMs,
      allowLocal: this.allowLocal,
      ...options,
    });
  }
}
