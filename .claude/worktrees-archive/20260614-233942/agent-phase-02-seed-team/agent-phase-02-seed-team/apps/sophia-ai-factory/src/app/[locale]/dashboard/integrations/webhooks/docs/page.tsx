/**
 * Webhook integration docs page — static, server component.
 * Event catalog + payload examples + signature verification snippets.
 * @module dashboard/integrations/webhooks/docs/page
 */

import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/seed/components/ui/tabs';

export const dynamic = 'force-dynamic';

const EVENT_EXAMPLES = [
  {
    name: 'mission.completed',
    description: 'Fired when a mission finishes successfully.',
    payload: {
      id: 'evt_01abc',
      event: 'mission.completed',
      tenantId: 'user_xyz',
      timestamp: '2026-05-03T10:00:00.000Z',
      data: {
        missionId: 'cmp_abc123',
        tenantId: 'user_xyz',
        status: 'completed',
        videoUrl: 'https://cdn.heygen.com/video/abc.mp4',
        durationSec: 45,
        costUsd: 1.2,
      },
    },
  },
  {
    name: 'video.ready',
    description: 'Fired when a video render is complete and available.',
    payload: {
      id: 'evt_02def',
      event: 'video.ready',
      tenantId: 'user_xyz',
      timestamp: '2026-05-03T10:00:05.000Z',
      data: {
        videoId: 'vid_def456',
        missionId: 'cmp_abc123',
        tenantId: 'user_xyz',
        r2Key: 'videos/abc123.mp4',
        publicUrl: 'https://cdn.heygen.com/video/abc.mp4',
        durationSec: 45,
      },
    },
  },
  {
    name: 'payment.received',
    description: 'Fired when a NOWPayments IPN confirms tier activation.',
    payload: {
      id: 'evt_03ghi',
      event: 'payment.received',
      tenantId: 'user_xyz',
      timestamp: '2026-05-03T11:00:00.000Z',
      data: {
        tenantId: 'user_xyz',
        amountUsd: 49,
        tier: 'PREMIUM',
        paymentId: 'np_789xyz',
        paidAt: '2026-05-03T11:00:00.000Z',
      },
    },
  },
  {
    name: 'error.threshold',
    description: 'Fired when the 24h error count exceeds the configured threshold.',
    payload: {
      id: 'evt_04jkl',
      event: 'error.threshold',
      tenantId: 'system',
      timestamp: '2026-05-03T05:00:00.000Z',
      data: {
        tenantId: 'system',
        errorCount24h: 42,
        severity: 'medium',
        sampleErrors: [
          { message: 'TypeError', timestamp: '2026-05-03T04:30:00.000Z' },
        ],
      },
    },
  },
  {
    name: 'affiliate.discovered',
    description: 'Fired when the affiliate scout finds a new partner opportunity.',
    payload: {
      id: 'evt_05mno',
      event: 'affiliate.discovered',
      tenantId: 'user_xyz',
      timestamp: '2026-05-03T09:00:00.000Z',
      data: {
        tenantId: 'user_xyz',
        affiliateId: 'aff_mno789',
        network: 'impact',
        commissionPct: 30,
        productName: 'Example SaaS Tool',
      },
    },
  },
];

const NODE_SNIPPET = `const crypto = require('crypto');

function verifySignature(rawBody, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature, 'hex')
  );
}

// In your Express handler:
app.post('/webhook', (req, res) => {
  const sig = req.headers['x-sophia-signature'];
  const raw = req.rawBody; // ensure raw body capture
  if (!verifySignature(raw, sig, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  const event = JSON.parse(raw);
  // Process event in your application (queue, db, etc.)
  res.status(200).send('OK');
});`;

const PYTHON_SNIPPET = `import hmac, hashlib

def verify_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        raw_body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

# In your Flask handler:
from flask import request, abort

@app.route('/webhook', methods=['POST'])
def webhook():
    sig = request.headers.get('X-Sophia-Signature', '')
    if not verify_signature(request.data, sig, WEBHOOK_SECRET):
        abort(401)
    event = request.json
    print('Received:', event['event'])
    return 'OK', 200`;

const CURL_SNIPPET = `# Test your endpoint manually with HMAC signature
SECRET="your_webhook_secret"
BODY='{"id":"test","event":"webhook.test","tenantId":"user_xyz","timestamp":"2026-05-03T10:00:00Z","data":{"message":"Hello from Sophia"}}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

curl -X POST https://your-server.com/webhook \\
  -H "Content-Type: application/json" \\
  -H "X-Sophia-Signature: $SIG" \\
  -d "$BODY"`;

export default async function WebhooksDocsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const t = await getTranslations('dashboard.integrations.webhooks');

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('docs_title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('docs_subtitle')}</p>
      </div>

      {/* How it works */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('docs_how_title')}</h2>
        <p className="text-sm text-muted-foreground">{t('docs_how_body')}</p>
        <div className="bg-muted/40 rounded-md p-3 font-mono text-xs">
          <div>POST {'<'}your-url{'>'}</div>
          <div>Content-Type: application/json</div>
          <div>X-Sophia-Signature: {'<'}hmac-sha256-hex{'>'}</div>
        </div>
      </section>

      {/* Event catalog */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t('docs_events_title')}</h2>
        {EVENT_EXAMPLES.map(ev => (
          <div key={ev.name} className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{ev.name}</code>
            </div>
            <p className="text-sm text-muted-foreground">{ev.description}</p>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
              {JSON.stringify(ev.payload, null, 2)}
            </pre>
          </div>
        ))}
      </section>

      {/* Signature verification */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t('docs_verify_title')}</h2>
        <p className="text-sm text-muted-foreground">{t('docs_verify_body')}</p>
        <Tabs defaultValue="nodejs">
          <TabsList>
            <TabsTrigger value="nodejs">Node.js</TabsTrigger>
            <TabsTrigger value="python">Python</TabsTrigger>
            <TabsTrigger value="curl">cURL</TabsTrigger>
          </TabsList>
          <TabsContent value="nodejs">
            <pre className="bg-muted rounded-md p-4 text-xs overflow-x-auto mt-2">
              {NODE_SNIPPET}
            </pre>
          </TabsContent>
          <TabsContent value="python">
            <pre className="bg-muted rounded-md p-4 text-xs overflow-x-auto mt-2">
              {PYTHON_SNIPPET}
            </pre>
          </TabsContent>
          <TabsContent value="curl">
            <pre className="bg-muted rounded-md p-4 text-xs overflow-x-auto mt-2">
              {CURL_SNIPPET}
            </pre>
          </TabsContent>
        </Tabs>
      </section>

      {/* Retry policy */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t('docs_retry_title')}</h2>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>{t('docs_retry_1')}</li>
          <li>{t('docs_retry_2')}</li>
          <li>{t('docs_retry_3')}</li>
        </ul>
      </section>
    </div>
  );
}
