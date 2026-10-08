# Tech Stack & Architecture: Viral Sound Pairing & Kinetic Subtitle Engine

## 1. Overview & Objective
Empower the Autonomous Video Factory with real-time viral sound pairing and high-engagement kinetic subtitles (Hormozi, MrBeast, Minimal Cyber, Neon Pulse) to maximize 3s hook retention and watch time on TikTok, YouTube Shorts, and Instagram Reels.

---

## 2. Clean 4-Layer Architecture

### Layer 1: Seed (`src/seed/types/viral-audio-types.ts`)
- **Sound Catalog Types**: `ViralSoundTrack`, `AudioCopyrightTier` (`ROYALTY_FREE_SAFE`, `PLATFORM_TRENDING_LICENSED`, `AI_GENERATED_BEATS`).
- **Kinetic Subtitle Schemas**: `SubtitleAnimationPreset` (`HORMOZI_HIGHLIGHT`, `BEAST_POP`, `MINIMAL_CYBER`, `NEON_PULSE`), `WordTimestamp`, `KineticSubtitleConfig`.
- **Inngest Event**: `viral.audio.compose.requested`.

### Layer 2: Tree (`src/tree/audio/`, `src/tree/subtitles/`)
- **Audio Ducking Engine**: Computes exact dynamic volume envelopes (-14 dB attenuation during voiceover, 120 ms logarithmic fade-in/fade-out).
- **BPM & Pacing Matcher**: Matches video cut tempo with audio beats-per-minute.
- **Kinetic Subtitle Formatter**: Converts word-level Whisper JSON timestamps into styled SSA/ASS subtitle events with animated highlight bounds.

### Layer 3: Forest (`src/forest/inngest/functions/viral-audio-composer-job.ts`)
- Background event worker orchestrating audio track resolution, volume normalization, and video track muxing.

### Layer 4: Land (`src/land/audio/actions/`)
- Authenticated Server Actions for sound catalog browsing, preview playback, and custom caption styling presets.

---

## 3. Storage & Multi-Tenancy
- **Cloudflare D1**: `viral_sound_catalog` and `video_subtitle_presets` tables with tenant isolation.
- **BYOK / Edge Safe**: No third-party operator subscriptions required.
