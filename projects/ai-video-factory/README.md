# 🎬 AI Video Factory

> Automated AI Video Production Pipeline for Multi-Channel Affiliate Marketing

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Start OpenClaw gateway
openclaw gateway start

# 4. Import n8n workflows
# Import files from ./workflows/ into n8n
```

## Project Structure

```
ai-video-factory/
├── config/                 # Configuration files
│   ├── affiliates.json    # Affiliate program database
│   ├── niches.json        # Niche configurations
│   └── voices.json        # Voice presets
├── workflows/              # n8n workflow exports
│   ├── script_generator.json
│   ├── voice_generator.json
│   ├── video_generator.json
│   ├── video_editor.json
│   ├── multi_publish.json
│   └── analytics.json
├── templates/              # Content templates
│   ├── scripts/           # Script templates by niche
│   ├── thumbnails/        # Canva thumbnail templates
│   └── descriptions/      # Video description templates
├── scripts/               # Automation scripts
│   ├── openclaw-skills/   # Custom OpenClaw skills
│   └── utils/             # Utility scripts
└── docs/                  # Documentation
    ├── setup-guide.md
    ├── workflow-sop.md
    └── affiliate-guide.md
```

## Tech Stack

| Component    | Tool                | Purpose                                 |
| ------------ | ------------------- | --------------------------------------- |
| Orchestrator | OpenClaw            | AI command center via Telegram/WhatsApp |
| Automation   | n8n                 | Workflow automation                     |
| Script       | ChatGPT API         | Content generation                      |
| Voice        | ElevenLabs          | Voice synthesis                         |
| Avatar       | D-ID / HeyGen       | Talking head videos                     |
| B-Roll       | Pictory             | Text-to-video                           |
| Edit         | CapCut / Creatomate | Video editing                           |
| Track        | Airtable            | Content management                      |

## Telegram Commands

```
/video [product] [style]    → Generate new video
/script [topic]             → Generate script only
/voice [script_id]          → Generate voiceover
/publish [video_id]         → Publish to all platforms
/stats                      → View analytics
/revenue                    → View affiliate earnings
```

## Monthly Cost

| Tier     | Cost | Videos | Cost/Video |
| -------- | ---- | ------ | ---------- |
| Minimal  | $80  | 30     | $2.67      |
| Standard | $120 | 60     | $2.00      |
| Scale    | $200 | 120+   | $1.67      |

## License

MIT - © 2026 AgencyOS
