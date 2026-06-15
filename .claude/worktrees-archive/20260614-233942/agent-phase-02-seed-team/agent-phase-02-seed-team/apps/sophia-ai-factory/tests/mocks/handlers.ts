import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock HeyGen API
  http.post('https://api.heygen.com/v2/video/generate', () => {
    return HttpResponse.json({
      data: {
        video_id: 'mock_video_id_123'
      }
    });
  }),

  http.get('https://api.heygen.com/v2/video/:videoId', ({ params }) => {
    return HttpResponse.json({
      data: {
        id: params.videoId,
        status: 'completed',
        video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        thumbnail_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg'
      }
    });
  }),

  http.get('https://api.heygen.com/v2/avatars', () => {
    return HttpResponse.json({
      data: {
        avatars: [
          { avatar_id: 'mock_avatar_1', name: 'Mock Avatar', gender: 'female', preview_image_url: '' }
        ]
      }
    });
  }),

  http.get('https://api.heygen.com/v2/voices', () => {
    return HttpResponse.json({
      data: {
        voices: [
          { voice_id: 'mock_voice_1', name: 'Mock Voice', gender: 'female', language: 'English' }
        ]
      }
    });
  }),

  // Mock ElevenLabs API
  http.post('https://api.elevenlabs.io/v1/text-to-speech/:voiceId', () => {
    // Return a dummy audio file (blob)
    // For simplicity in MSW, we can return a text or generic blob, but the client expects audio/mpeg
    // We'll return a simple string that will fail blob conversion if not handled,
    // but our MockService handles this.
    // Ideally we return a valid minimal MP3 binary here if we were testing the real client deeply.
    return new HttpResponse(new ArrayBuffer(10), {
      headers: {
        'Content-Type': 'audio/mpeg'
      }
    });
  }),

  // Mock OpenRouter API
  http.post('https://openrouter.ai/api/v1/chat/completions', () => {
    return HttpResponse.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Mock Script",
              scenes: [
                {
                  scene_number: 1,
                  visual_description: "Mock visual",
                  narration: "Mock narration",
                  duration_estimate: 5
                }
              ],
              total_duration: 5
            })
          }
        }
      ]
    });
  }),
];
