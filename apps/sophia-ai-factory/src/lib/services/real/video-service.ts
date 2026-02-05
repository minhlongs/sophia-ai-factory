import { IVideoService, CreateVideoParams, VideoStatus, Avatar, Voice } from "../types";
import { getHeyGenClient } from "@/lib/heygen/heygen-client";

export class RealVideoService implements IVideoService {
  async createVideo(params: CreateVideoParams): Promise<string> {
    const client = getHeyGenClient();
    if (!client) {
      throw new Error("HeyGen Client not available (API Key missing)");
    }
    return client.createVideo(params);
  }

  async getVideoStatus(videoId: string): Promise<VideoStatus> {
    const client = getHeyGenClient();
    if (!client) {
      throw new Error("HeyGen Client not available");
    }
    const status = await client.getVideoStatus(videoId);

    return {
      id: status.id,
      status: status.status,
      video_url: status.video_url,
      thumbnail_url: status.thumbnail_url,
      error: status.error
    };
  }

  async listAvatars(): Promise<Avatar[]> {
    const client = getHeyGenClient();
    if (!client) return [];
    const avatars = await client.listAvatars();
    // Map HeyGenAvatar to generic Avatar
    return avatars.map(a => ({
      ...a,
    }));
  }

  async listVoices(): Promise<Voice[]> {
    const client = getHeyGenClient();
    if (!client) return [];
    const voices = await client.listVoices();
    return voices.map(v => ({
      ...v,
    }));
  }
}
