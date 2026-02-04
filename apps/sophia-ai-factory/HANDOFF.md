# Welcome to Sophia AI Factory 🤖

**The Turnkey AI Video Production Empire**

Congratulations on acquiring Sophia AI Factory. This software automates the entire process of finding affiliate products, writing scripts, generating AI videos, and managing your content calendar.

## 🚀 Getting Started (3 Steps)

You do **NOT** need to be a developer to use this. Follow these 3 steps to launch your factory.

### Step 1: Install
1. Open your terminal (Command Prompt on Windows, Terminal on Mac).
2. Navigate to the folder where you unzipped this project.
3. Run the following command to install dependencies:
   ```bash
   npm install
   ```
   *(Wait for it to finish. It may take 1-2 minutes.)*

### Step 2: Launch
Run this command to start the application:
```bash
npm run dev
```
You will see a message saying `Ready in [time]`.

### Step 3: Setup Wizard
1. Open your web browser (Chrome recommended).
2. Go to: **[http://localhost:3000](http://localhost:3000)**
3. You will be automatically redirected to the **Setup Wizard**.

---

## 🧙 The Setup Wizard

The Wizard will guide you through connecting your AI "Brains". You will need the following API Keys:

1. **OpenRouter API Key** (For Script Writing)
   - Get it here: [openrouter.ai/keys](https://openrouter.ai/keys)
2. **ElevenLabs API Key** (For Voiceovers)
   - Get it here: [elevenlabs.io/subscription](https://elevenlabs.io/subscription)
3. **D-ID API Key** (For AI Avatars)
   - Get it here: [studio.d-id.com/account-settings](https://studio.d-id.com/account-settings)
4. **Airtable Personal Access Token** (For Database)
   - Get it here: [airtable.com/create/tokens](https://airtable.com/create/tokens)
   - **Important**: Give it `data.records:read` and `data.records:write` scopes.

**Don't have a Database yet?**
The Wizard provides a link to "Copy Template Base". Click it, copy the base to your Airtable account, and copy the **Base ID** from the URL into the Wizard.

---

## ❓ Troubleshooting

**"I see a red error when verifying a key"**
- Double-check you copied the entire key.
- Ensure your account has credits/billing set up on that service.

**"The setup wizard didn't appear"**
- Go directly to: [http://localhost:3000/setup-wizard](http://localhost:3000/setup-wizard)

**"I want to reset my configuration"**
- Delete the `.env.local` file in the project folder.
- Restart the app (`npm run dev`).
- The Wizard will appear again.

---

*Powered by Mekong CLI*
