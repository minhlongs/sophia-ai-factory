# Tech Stack & Architecture: Multi-Language Lip-Sync Dubbing Engine

## 1. Overview & Objective
Enable global geographic scaling for viral video campaigns by taking high-performing G0 English videos and autonomously breeding localized variants in Vietnamese (VN), Spanish (ES), Indonesian (ID), and Japanese (JA) with voice cloning and AI lip-sync synchronization.

---

## 2. Clean 4-Layer Architecture

### Layer 1: Seed (`src/seed/types/multilingual-dubbing-types.ts`)
- **Target Locales**: `SUPPORTED_LOCALES` = `['en', 'vi', 'es', 'id', 'ja']`.
- **Dubbing Schemas**: `DubbingJobSchema`, `VoiceCloneProfileSchema`, `LocalizedCtaSchema`.
- **Inngest Event**: `multilingual.dubbing.requested`.

### Layer 2: Tree (`src/tree/dubbing/`)
- **Script Translation & Time-Stretch Adapter**: Translates script via OpenRouter/Claude while estimating syllable count and applying audio pacing multipliers ($0.95x - 1.15x$) to guarantee sync with original video cuts.
- **Localized Affiliate Mapper**: Swaps target affiliate links and coupon codes to market-specific destinations based on target locale.
- **Lip-Sync Video Synthesizer**: Prepares payload for HeyGen/Wav2Lip edge rendering.

### Layer 3: Forest (`src/forest/inngest/functions/multilingual-dubbing-job.ts`)
- Inngest step workflow coordinating translation, ElevenLabs multi-speaker voice synthesis, and lip-sync video generation.

### Layer 4: Land (`src/land/dubbing/actions/`)
- Authenticated Server Actions (`dispatchMultilingualDubAction`, `listLocalizedLineagesAction`) enforcing tenant isolation and session verification.

---

## 3. Storage & Quality Guardrails
- **Cloudflare D1**: `video_dubbing_lineages` table tracking localized child variants ($G_0^{EN} \to G_1^{VN}, G_1^{ES}$).
- **BYOK Safe**: Uses customer-provided ElevenLabs, HeyGen, and OpenRouter keys stored encrypted in D1/KV.
