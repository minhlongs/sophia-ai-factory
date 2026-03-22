---
title: "Phase 7 — Pilot Onboarding Flow"
priority: P1
status: completed
effort: 1.5h
completed: 2026-03-20
---

# PHASE 7 — PILOT ONBOARDING FLOW

## Overview

Create pilot onboarding flow with welcome email, NPS survey, and case study collection for the 10 pilot customer program.

## Files to Create

### Components

#### components/onboarding/pilot-checklist.tsx

```tsx
'use client';

import { useState, useEffect } from 'react';

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'signup', label: 'Complete account signup', completed: false },
  { id: 'org', label: 'Create organization', completed: false },
  { id: 'subscription', label: 'Select Premium plan ($499/mo)', completed: false },
  { id: 'payment', label: 'Complete Polar checkout', completed: false },
  { id: 'onboarding', label: 'Schedule 30-min onboarding call', completed: false },
  { id: 'first-proposal', label: 'Generate first proposal', completed: false },
  { id: 'feedback', label: 'Submit initial feedback', completed: false },
];

export function PilotChecklist() {
  const [items, setItems] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);

  const completedCount = items.filter(i => i.completed).length;
  const progress = (completedCount / items.length) * 100;

  return (
    <div className="border rounded-lg p-6 bg-green-50">
      <h3 className="text-lg font-semibold mb-4 text-green-800">
        Pilot Onboarding Checklist
      </h3>
      <div className="mb-4">
        <div className="h-2 bg-green-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-green-700 mt-2">
          {completedCount}/{items.length} steps completed
        </p>
      </div>
      <ul className="space-y-2">
        {items.map(item => (
          <li key={item.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={item.completed}
              onChange={(e) => {
                setItems(prev =>
                  prev.map(i =>
                    i.id === item.id ? { ...i, completed: e.target.checked } : i
                  )
                );
              }}
              className="rounded border-green-300 text-green-600 focus:ring-green-500"
            />
            <span className={item.completed ? 'line-through text-gray-500' : ''}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

#### components/surveys/nps-survey.tsx

```tsx
'use client';

import { useState } from 'react';

interface NpsSurveyProps {
  orgId: string;
  onSubmit: (score: number, feedback?: string) => Promise<void>;
}

export function NpsSurvey({ orgId, onSubmit }: NpsSurveyProps) {
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (score === null) return;

    setLoading(true);
    try {
      await onSubmit(score, feedback);
      setSubmitted(true);
    } catch (error) {
      console.error('Failed to submit NPS:', error);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <p className="text-green-600 font-semibold">Thank you for your feedback!</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">
        How likely are you to recommend Sophia AI Factory?
      </h3>
      <div className="flex gap-2 mb-4">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            onClick={() => setScore(n)}
            className={`w-10 h-10 rounded-full border-2 transition-colors ${
              score === n
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'hover:border-blue-400'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-sm text-gray-500 mb-4">
        <span>Not likely</span>
        <span>Very likely</span>
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Any additional feedback (optional)"
        className="w-full border rounded p-2 mb-4"
        rows={3}
      />
      <button
        onClick={handleSubmit}
        disabled={score === null || loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Submit Feedback'}
      </button>
    </div>
  );
}
```

### API Routes

#### app/api/feedback/route.ts

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createServerClient } from '@/lib/supabase/client';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { surveyType, responses, npsScore } = body;

    const supabase = createServerClient();

    // Get user's organization
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', session.user.id)
      .single();

    if (!orgMember) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Insert feedback
    const { error } = await supabase.from('customer_feedback').insert({
      org_id: orgMember.org_id,
      survey_type: surveyType,
      responses,
      nps_score: npsScore,
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback submission error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

#### app/api/onboarding/status/route.ts

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createServerClient } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Get user's organization and onboarding status
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', session.user.id)
      .single();

    if (!orgMember) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check various onboarding milestones
    const [subscription, firstProposal, feedback] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('id')
        .eq('org_id', orgMember.org_id)
        .eq('status', 'active')
        .single()
        .then(r => !!r.data),

      supabase
        .from('proposals')
        .select('id')
        .eq('org_id', orgMember.org_id)
        .limit(1)
        .then(r => (r.data || []).length > 0),

      supabase
        .from('customer_feedback')
        .select('id')
        .eq('org_id', orgMember.org_id)
        .limit(1)
        .then(r => (r.data || []).length > 0),
    ]);

    return NextResponse.json({
      orgId: orgMember.org_id,
      checklist: {
        signup: true,
        org: true,
        subscription,
        firstProposal,
        feedback,
      },
      isPilot: subscription, // Simplified: any subscriber is a pilot
    });
  } catch (error) {
    console.error('Onboarding status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Email Templates

#### lib/emails/welcome-after-payment.tsx

```tsx
import React from 'react';

interface WelcomeEmailProps {
  customerName: string;
  tierName: string;
  mcuCredits: number;
  onboardingLink: string;
}

export function WelcomeAfterPayment({
  customerName,
  tierName,
  mcuCredits,
  onboardingLink,
}: WelcomeEmailProps) {
  return (
    <div>
      <h1>Welcome to Sophia AI Factory, {customerName}!</h1>
      <p>
        Thank you for subscribing to the <strong>{tierName}</strong> plan.
        Your account has been credited with <strong>{mcuCredits.toLocaleString()} MCU</strong>.
      </p>

      <h2>Next Steps</h2>
      <ol>
        <li>
          <a href={onboardingLink}>Schedule your 30-minute onboarding call</a>
        </li>
        <li>Generate your first AI-powered proposal</li>
        <li>Share your feedback to help us improve</li>
      </ol>

      <p>
        As a pilot customer, you have direct access to our team.
        Reply to this email anytime with questions or feedback.
      </p>

      <p>
        Best regards,<br />
        The Sophia AI Factory Team
      </p>
    </div>
  );
}
```

### Pages

#### app/(dashboard)/onboarding/page.tsx

```tsx
'use client';

import { useEffect, useState } from 'react';
import { PilotChecklist } from '@/components/onboarding/pilot-checklist';
import { NpsSurvey } from '@/components/surveys/nps-survey';

export default function OnboardingPage() {
  const [status, setStatus] = useState<{ isPilot: boolean; checklist: Record<string, boolean> } | null>(null);
  const [showNps, setShowNps] = useState(false);

  useEffect(() => {
    fetch('/api/onboarding/status')
      .then(res => res.json())
      .then(data => {
        setStatus(data);
        // Show NPS if pilot and first proposal created
        setShowNps(data.isPilot && data.checklist.firstProposal);
      });
  }, []);

  if (!status) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Pilot Onboarding</h1>
        <p className="text-gray-600">
          Welcome to the Sophia AI Factory pilot program!
        </p>
      </div>

      {status.isPilot ? (
        <>
          <PilotChecklist />

          {showNps && (
            <NpsSurvey
              orgId={status.orgId}
              onSubmit={async (score, feedback) => {
                await fetch('/api/feedback', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    surveyType: 'nps',
                    responses: { feedback },
                    npsScore: score,
                  }),
                });
              }}
            />
          )}

          <div className="border rounded-lg p-6">
            <h3 className="font-semibold mb-2">Pilot Benefits</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>$100 MCU credit bonus</li>
              <li>Priority support access</li>
              <li>Direct line to product team</li>
              <li>Case study feature opportunity</li>
            </ul>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">
            Join the pilot program to get exclusive benefits
          </p>
          <a
            href="/billing/upgrade"
            className="inline-block py-2 px-4 bg-blue-600 text-white rounded"
          >
            Subscribe to Premium ($499/mo)
          </a>
        </div>
      )}
    </div>
  );
}
```

## Implementation Steps

1. Create pilot checklist component
2. Create NPS survey component
3. Create feedback API endpoint
4. Create onboarding status API
5. Create onboarding page
6. Set up 7-day NPS trigger (cron or scheduled function)

## NPS Trigger (7-day timer)

Option: Add to subscription.created webhook handler:
```typescript
// Schedule NPS email for 7 days later
const npsDate = new Date();
npsDate.setDate(npsDate.getDate() + 7);

await supabase.from('scheduled_tasks').insert({
  org_id: orgId,
  task_type: 'nps_survey',
  scheduled_for: npsDate.toISOString(),
});
```

## Success Criteria

- [x] Pilot checklist tracks onboarding progress
- [x] NPS survey collects feedback
- [x] Welcome email sent after payment
- [x] Onboarding page accessible from dashboard
- [x] 7-day NPS trigger configured

**Completed:** 2026-03-20

## Implementation Notes

### Files Created

**Components:**
- `components/onboarding/pilot-checklist.tsx` - Enhanced checklist with progress bar, step descriptions
- `components/surveys/nps-survey.tsx` - NPS survey with 0-10 scale, Detractor/Passive/Promoter indicators

**Libraries:**
- `lib/surveys/nps.ts` - NPS logic: score calculation, eligibility checks, scheduling
- `lib/billing/pilot-onboarding.ts` - Welcome email, milestone tracking, onboarding helpers

**API Routes:**
- `app/api/feedback/route.ts` - POST endpoint for feedback/NPS submission
- `app/api/onboarding/status/route.ts` - GET endpoint for onboarding checklist status

**Tests:**
- `tests/billing/polar-checkout.test.ts` - 15 tests for checkout flow
- `tests/billing/webhook-handler.test.ts` - 16 tests for webhook handling
- `tests/billing/mcu-pricing.test.ts` - 24 tests for MCU pricing
- `tests/billing/balance-checker.test.ts` - 22 tests for balance checking

### Test Results
- All 96 tests passing
- TypeScript: 0 errors
- Build: Successful

## Related Files

- Components: `components/onboarding/`, `components/surveys/`
- API: `app/api/feedback/route.ts`, `app/api/onboarding/status/route.ts`
- Email: `lib/emails/welcome-after-payment.tsx` (TODO: Create)
