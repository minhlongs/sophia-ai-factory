import { GuideContentRenderer } from "@/components/guide/guide-content-renderer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Telegram Bot Commands — Sophia AI Factory Guide",
  description: "Complete reference for Sophia Telegram bot commands",
};

const content = `# Telegram Bot Commands / Lenh Bot Telegram

Sophia has a Telegram bot that lets you manage everything from your phone.
**Bot:** @Sophia_Bbot

---

## Quick Start / Bat Dau Nhanh

1. Open Telegram
2. Search for **@Sophia_Bbot** (or use this link: [t.me/Sophia_Bbot](https://t.me/Sophia_Bbot))
3. Press **"Start"**
4. Link your email: \`/email your@email.com\`

---

## Available Commands / Danh Sach Lenh

| Command | What It Does | Example |
|---------|-------------|---------|
| \`/start\` | Welcome message + setup | \`/start\` |
| \`/email\` | Link your Sophia account | \`/email john@example.com\` |
| \`/campaign\` | Create a new video campaign | \`/campaign Eco-friendly gadgets review\` |
| \`/status\` | Check your active campaigns | \`/status\` |
| \`/results\` | Get links to completed videos | \`/results\` |
| \`/help\` | Show all available commands | \`/help\` |

---

## How To Create a Video via Telegram / Tao Video Qua Telegram

**Step 1:** Make sure your account is linked (\`/email\`)

**Step 2:** Type \`/campaign\` followed by your video topic

**Step 3:** Sophia will write the script, create voice, generate avatar video

**Step 4:** Type \`/status\` to check progress

**Step 5:** Type \`/results\` to get the YouTube link when done

That's it!

---

## Pro Tips / Meo Hay

- **Be specific with topics:** \`/campaign Top 5 wireless earbuds under $50 review\` is better than \`/campaign earbuds\`
- **Check status regularly:** campaigns take 5-10 minutes to complete
- **All your data belongs to YOU** — videos are published directly to YOUR YouTube channel
- **Multiple campaigns:** you can create multiple campaigns and check status of all at once
`;

export default function CommandsGuidePage() {
  return <GuideContentRenderer content={content} />;
}
