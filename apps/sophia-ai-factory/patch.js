const fs = require('fs');
const file = 'src/seed/inngest/event-types.ts';
let content = fs.readFileSync(file, 'utf8');

const importStatement = `import type {
  TrafficRedirect,
  YieldRouterHealthCheck,
  ShadowbanTelemetryEvent,
  ScriptCultureIndexRequest,
} from "@/seed/types/growth-triad-v9-types";
`;

content = content.replace('import { Tier } from "@/seed/types";', importStatement + 'import { Tier } from "@/seed/types";');

// Now add the payload types
const payloadTypes = `
export type AffiliateYieldRoutedEvent = {
  data: {
    routerId: string;
    redirects: TrafficRedirect[];
    healthStatus: YieldRouterHealthCheck['status'];
  };
};

export type ShadowbanAnomalyDetectedEvent = {
  data: ShadowbanTelemetryEvent;
};

export type SemanticCultureScoredEvent = {
  data: ScriptCultureIndexRequest & {
    score: number;
    cultureMatch: "HIGH" | "MEDIUM" | "LOW";
  };
};
`;

content = content.replace('export type Events = {', payloadTypes + '\nexport type Events = {');

content = content.replace('  "subscriber.cohort.evaluated": SubscriberCohortEvaluatedEvent;', '  "subscriber.cohort.evaluated": SubscriberCohortEvaluatedEvent;\n  "affiliate.yield.routed": AffiliateYieldRoutedEvent;\n  "shadowban.anomaly.detected": ShadowbanAnomalyDetectedEvent;\n  "semantic.culture.scored": SemanticCultureScoredEvent;');

// Also fix the documentation count so no test fails (if it mentions 86 somewhere, it says 86 but let's check).
// Wait, client-merge.test.ts is the main one that checks counts. The comment says 41 keys... no, wait.

fs.writeFileSync(file, content);
