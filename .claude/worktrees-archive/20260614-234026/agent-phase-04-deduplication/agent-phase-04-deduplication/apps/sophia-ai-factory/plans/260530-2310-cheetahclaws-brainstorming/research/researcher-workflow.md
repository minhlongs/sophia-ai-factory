# Paradigm Comparison: n8n + Airtable vs. CheetahClaws Workflows
## Campaign Script Generation & Video Rendering (Remotion/FFmpeg)

### 1. Paradigm Overview
* **n8n + Airtable CMS:** Low-code visual orchestrator using node graphs. Airtable acts as database, content management UI, and manual approval stage. n8n triggers on record updates, invokes LLM endpoints (Ollama/OpenAI), writes responses back, and triggers rendering webhooks.
* **CheetahClaws Workflows:** Code-driven, developer-first pipeline (TypeScript/Python) versioned in Git. Uses schema validation (Zod/Pydantic) to parse LLM outputs, handles rendering (Remotion/FFmpeg) natively, and runs on local hardware.

### 2. Trade-Off Analysis

| Dimension | n8n + Airtable CMS (Visual Low-Code) | CheetahClaws (Code-Driven Workflows) |
| :--- | :--- | :--- |
| **Type Safety** | Loose. Runtime schema drift in Airtable or LLM output breaks nodes silently. | Strict. Type systems (TS/Zod) guarantee matching parameters for video renderers. |
| **Versioning** | Hard. Workflow JSON files are monolithic and produce unreadable Git diffs. | Native Git. Easy to branch, PR-review prompts, roll back, and track logic history. |
| **Error Handling** | Basic retries. Complex branching/failovers result in messy spaghetti graphs. | Rich. Catch blocks, token limits, fallback models, and exponential backoffs. |
| **Testing** | Manual. Virtually impossible to unit test individual nodes or mock API failures. | Automated. Simple to mock LLM calls, run CI/CD, and assert video output schemas. |
| **Team Usability** | Non-technical friendly. Owners can view pipeline state and approve scripts in Airtable. | Dev-dependent. Requires a CLI, code changes, or custom UI wrapper for approvals. |

### 3. Workflow Implementation Deep-Dive

#### A. Campaign Script Generation
* **n8n + Airtable:** Good for simple chaining. However, translation (e.g. EN -> RU/VI) and formatting checks (e.g., verifying if the LLM output is a valid JSON array matching character limits) require writing JavaScript inside `Code` nodes without autocomplete or type guards.
* **CheetahClaws:** Custom prompt templates are written in code. The LLM output is parsed via Zod/Pydantic to ensure duration and caption structures are correct *before* passing to the video renderer, avoiding failed video builds.

#### B. Video Rendering (Remotion/FFmpeg)
* **n8n + Airtable:** Rendering is CPU/GPU intensive and requires detailed media metadata (e.g., getting audio duration via `Mediabunny` or matching frame rates). n8n cannot run Remotion natively; it must execute shell commands or call a webhook, providing zero real-time progress tracking or frame-by-frame error logging.
* **CheetahClaws:** Since it's a native Node/Python environment, CheetahClaws can import Remotion libraries, inspect media dimensions directly (`@remotion/renderer`), dynamic-compile compositions based on script length, and stream standard output logs cleanly.

### 4. Recommendation for Win House
A **Hybrid Architecture** offers the best balance:
1. **CMS & Trigger Layer (Airtable):** Keep Airtable as the collaborative UI where Mr. Louis reviews, edits, and clicks "Approve".
2. **Visual Router (n8n):** Keep n8n to listen to Airtable triggers and send user notifications (e.g., Telegram alerts).
3. **Execution Engine (CheetahClaws CLI/Service):** Delegate the heavy lifting. n8n calls a CheetahClaws endpoint to run the type-safe script generation, run local validation, and trigger the native Remotion rendering pipeline.

---
**Unresolved Questions:**
* Does the existing Mac Studio M1 Max have the required node dependencies installed globally for Remotion CLI execution under CheetahClaws?
