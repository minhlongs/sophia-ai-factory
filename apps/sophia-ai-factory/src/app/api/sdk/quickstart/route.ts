/**
 * GET /api/sdk/quickstart
 *
 * Delivers the homepage "5 lines of code" promise as a concrete artifact:
 * a copy-paste TypeScript snippet the caller can paste into their own
 * project to invoke any of the 6 algorithm endpoints with their own
 * Sophia session or OpenClaw exchange token.
 *
 * Query param:
 *   ?surface=affiliate|translate|voice|seo|stats|publish|all  (default: all)
 *
 * Public endpoint — no auth required. Returns a structured snippet
 * payload plus a rendered code string.
 *
 * @module app/api/sdk/quickstart
 */
import { NextRequest, NextResponse } from 'next/server';

interface Snippet {
  surface: string;
  description: string;
  curl: string;
  ts: string;
}

const BASE = 'https://sophia.agencyos.network';

const SNIPPETS: Snippet[] = [
  {
    surface: 'affiliate',
    description: 'Build a video description with the user’s affiliate links embedded.',
    curl: `curl -H "Authorization: Bearer $SOPHIA_TOKEN" "${BASE}/api/videos/<videoId>/description-enriched?niche=tech&max=3"`,
    ts: `const res = await fetch("${BASE}/api/videos/<videoId>/description-enriched?niche=tech&max=3", { headers: { Authorization: \`Bearer \${token}\` } });
const { description } = await res.json();`,
  },
  {
    surface: 'translate',
    description: 'Translate any text via your BYOK OpenRouter key.',
    curl: `curl -X POST -H "Authorization: Bearer $SOPHIA_TOKEN" -H "Content-Type: application/json" -d '{"text":"Hello world","fromLang":"en","toLang":"vi"}' "${BASE}/api/translate"`,
    ts: `const res = await fetch("${BASE}/api/translate", { method: "POST", headers: { Authorization: \`Bearer \${token}\`, "Content-Type": "application/json" }, body: JSON.stringify({ text: "Hello", fromLang: "en", toLang: "vi" }) });
const { translated } = await res.json();`,
  },
  {
    surface: 'voice',
    description: 'Clone a voice via your BYOK ElevenLabs key.',
    curl: `curl -X POST -H "Authorization: Bearer $SOPHIA_TOKEN" -H "Content-Type: application/json" -d '{"name":"My Voice","audioUrls":["https://r2.example/sample.mp3"]}' "${BASE}/api/voice/clone"`,
    ts: `const res = await fetch("${BASE}/api/voice/clone", { method: "POST", headers: { Authorization: \`Bearer \${token}\`, "Content-Type": "application/json" }, body: JSON.stringify({ name: "My Voice", audioUrls: ["https://r2.example/sample.mp3"] }) });
const { voiceId } = await res.json();`,
  },
  {
    surface: 'seo',
    description: 'Generate an SEO-scored script via your BYOK OpenRouter key.',
    curl: `curl -X POST -H "Authorization: Bearer $SOPHIA_TOKEN" -H "Content-Type: application/json" -d '{"topic":"affiliate marketing","keywords":["passive income","byok"]}' "${BASE}/api/scripts/seo"`,
    ts: `const res = await fetch("${BASE}/api/scripts/seo", { method: "POST", headers: { Authorization: \`Bearer \${token}\`, "Content-Type": "application/json" }, body: JSON.stringify({ topic: "affiliate marketing", keywords: ["passive income"] }) });
const { script, seoScore, suggestedTitles } = await res.json();`,
  },
  {
    surface: 'stats',
    description: 'Pull live homepage counters (public, no auth).',
    curl: `curl "${BASE}/api/stats/live"`,
    ts: `const res = await fetch("${BASE}/api/stats/live");
const { missionsCompleted, paidAgencies, videosGenerated } = await res.json();`,
  },
  {
    surface: 'publish',
    description: 'Schedule a video for auto-publish to a registered channel.',
    curl: `curl -X POST -H "Authorization: Bearer $SOPHIA_TOKEN" -H "Content-Type: application/json" -d '{"videoId":"<videoId>","channelId":"<channelId>","scheduledAt":1780000000}' "${BASE}/api/publish/quick-schedule"`,
    ts: `const res = await fetch("${BASE}/api/publish/quick-schedule", { method: "POST", headers: { Authorization: \`Bearer \${token}\`, "Content-Type": "application/json" }, body: JSON.stringify({ videoId, channelId, scheduledAt: Math.floor(Date.now()/1000) + 3600 }) });
const { jobId } = await res.json();`,
  },
];

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const surface = (searchParams.get('surface') ?? 'all').toLowerCase();

  const selected =
    surface === 'all' ? SNIPPETS : SNIPPETS.filter((s) => s.surface === surface);

  if (selected.length === 0) {
    return NextResponse.json(
      {
        error: 'UNKNOWN_SURFACE',
        message: `surface must be one of: ${SNIPPETS.map((s) => s.surface).join(', ')}, or 'all'`,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      base: BASE,
      tokenHint:
        'Use POST /api/openclaw/exchange to mint a short-lived Bearer for programmatic calls, or send the browser session cookie.',
      snippets: selected,
    },
    {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' },
    },
  );
}
