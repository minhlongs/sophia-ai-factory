import type { VideoEngine } from './video-engine';
import type { VideoEngineCapabilities } from './video-engine-capabilities';

export interface RegisteredEngine {
  engine: VideoEngine;
  priority: number;
  healthy: boolean;
}

export class VideoEngineRegistry {
  private engines: Map<string, RegisteredEngine> = new Map();

  register(engine: VideoEngine, priority = 0): void {
    this.engines.set(engine.id, { engine, priority, healthy: true });
  }

  unregister(id: string): void {
    this.engines.delete(id);
  }

  setHealth(id: string, healthy: boolean): void {
    const entry = this.engines.get(id);
    if (entry) entry.healthy = healthy;
  }

  getEngine(id: string): VideoEngine | undefined {
    return this.engines.get(id)?.engine;
  }

  listEngines(): VideoEngine[] {
    return [...this.engines.values()]
      .filter((e) => e.healthy)
      .sort((a, b) => b.priority - a.priority)
      .map((e) => e.engine);
  }

  findByCapability(generationType: string): VideoEngine[] {
    return this.listEngines().filter((e) =>
      e.capabilities.generationTypes.includes(generationType as VideoEngineCapabilities['generationTypes'][number]),
    );
  }

  getFallbackChain(type: 'talking_head' | 'voiceover' | 'text_to_video'): VideoEngine[] {
    return this.findByCapability(type);
  }
}

export const globalRegistry = new VideoEngineRegistry();
