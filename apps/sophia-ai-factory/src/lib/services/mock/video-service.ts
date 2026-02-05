import { IVideoService, CreateVideoParams, VideoStatus, Avatar, Voice } from "../types";

export class MockVideoService implements IVideoService {
  async createVideo(params: CreateVideoParams): Promise<string> {
    console.log("[MockVideoService] Creating video with params:", params);
    return `mock_vid_${Date.now()}`;
  }

  async getVideoStatus(videoId: string): Promise<VideoStatus> {
    console.log(`[MockVideoService] Checking status for ${videoId}`);
    return {
      id: videoId,
      status: "completed",
      video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      thumbnail_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg"
    };
  }

  async listAvatars(): Promise<Avatar[]> {
    return [
      { avatar_id: "mock_avatar_1", name: "Mock Avatar 1", gender: "female", preview_image_url: "" },
      { avatar_id: "mock_avatar_2", name: "Mock Avatar 2", gender: "male", preview_image_url: "" }
    ];
  }

  async listVoices(): Promise<Voice[]> {
    return [
      { voice_id: "mock_voice_1", name: "Mock Voice 1", gender: "female", language: "English" },
      { voice_id: "mock_voice_2", name: "Mock Voice 2", gender: "male", language: "English" }
    ];
  }
}
