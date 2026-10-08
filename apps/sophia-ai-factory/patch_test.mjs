import fs from 'fs';
const file = 'src/seed/inngest/__tests__/client-merge.test.ts';
let content = fs.readFileSync(file, 'utf8');

// Add the 3 new keys to the expected keys list
const replacementKeys = `  'subscriber.cohort.evaluated',
  'affiliate.yield.routed',
  'shadowban.anomaly.detected',
  'semantic.culture.scored',`;
content = content.replace("  'subscriber.cohort.evaluated',", replacementKeys);

// Replace 86 with 89
content = content.replace(/86/g, '89');

fs.writeFileSync(file, content);
